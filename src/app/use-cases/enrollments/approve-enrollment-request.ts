import { EnrollmentRequestRepository } from '../../../ports/repositories/enrollment-request.repo';
import { EnrollmentRepository } from '../../../ports/repositories/enrollment.repo';
import { CourseClassRepository } from '../../../ports/repositories/course-class.repo';
import { CourseRepository } from '../../../ports/repositories/course.repo';
import { SchoolFinancialChargeRepository } from '../../../ports/repositories/school-financial-charge.repo';
import { UserRepository } from '../../../ports/repositories/user.repo';
import { SchoolRepository } from '../../../ports/repositories/school.repo';
import { DependentRepository } from '../../../ports/repositories/dependent.repo';
import { OutboxRepository } from '../../../ports/repositories/outbox.repo';
import { AppError, ErrorCode } from '../../../shared/errors';
import { Enrollment } from '../../../domain/entities/enrollment';
import { EnrollmentRequest } from '../../../domain/entities/enrollment-request';
import { SchoolFinancialCharge } from '../../../domain/entities/school-financial-charge';
import { Course } from '../../../domain/entities/course';
import { CourseClass } from '../../../domain/entities/course-class';
import { UserPersonaEnum } from '../../../domain/value-objects/user-persona';
import { Uuid } from '../../../shared/uuid';
import { getUtcDay, toUtcDateOnly } from '../../../shared/date-utils';
import { formatEnrollmentChargeDescription } from '../../../shared/format-school-charge-description';
import type { ApproveEnrollmentRequestInput, ApproveEnrollmentRequestOutput } from '../../types/enrollment.types';
import type { IssueEnrollmentFeeBoleto } from '../payments/issue-enrollment-fee-boleto';
import type { GenerateTuitionPix } from '../payments/generate-tuition-pix';
import type { NotifyStudentUser } from '../shared/notify-student-user';
import { resolveNonprofitTuitionExemptionType } from '../../../shared/nonprofit-school';
import type { TuitionExemptionType } from '../../../domain/value-objects/tuition-exemption-type';

export class ApproveEnrollmentRequest {
    constructor(
        private readonly requests: EnrollmentRequestRepository,
        private readonly enrollments: EnrollmentRepository,
        private readonly classes: CourseClassRepository,
        private readonly courses: CourseRepository,
        private readonly financialCharges: SchoolFinancialChargeRepository,
        private readonly issueEnrollmentFeeBoleto?: IssueEnrollmentFeeBoleto,
        private readonly generateTuitionPix?: GenerateTuitionPix,
        private readonly users?: UserRepository,
        private readonly schools?: SchoolRepository,
        private readonly dependents?: DependentRepository,
        private readonly outbox?: OutboxRepository,
        private readonly notifyStudent?: NotifyStudentUser,
        private readonly frontendBaseUrl?: string
    ) {}

    async exec(input: ApproveEnrollmentRequestInput): Promise<ApproveEnrollmentRequestOutput> {
        // Validar e carregar solicitação
        const request = await this.validateAndLoadRequest(input.requestId);

        // Validar que pode ser aprovada
        this.validateRequestCanBeApproved(request, input.approverUserId);

        // Verificar se já existe matrícula
        await this.ensureNoExistingEnrollment(
            request.courseClassId,
            request.requestedForUserId,
            request.requestedForDependentId
        );

        // Buscar curso para obter o valor cheio (curso ou turma)
        const courseClass = await this.classes.findById(request.courseClassId);
        if (!courseClass) {
            throw AppError.fromCode(ErrorCode.COURSE_CLASS_NOT_FOUND, {
                courseClassId: request.courseClassId,
                requestId: request.id
            });
        }
        const course = await this.courses.findById(courseClass.courseId);
        if (!course) {
            throw AppError.fromCode(ErrorCode.COURSE_NOT_FOUND, {
                courseId: courseClass.courseId,
                requestId: request.id
            });
        }
        const school = this.schools ? await this.schools.findById(request.schoolId) : null;
        const isNonprofit = school?.isNonprofitAssociation === true;
        const tuitionExemptionType = resolveNonprofitTuitionExemptionType(
            isNonprofit,
            request.tuitionExemptionType
        );

        // Preço da mensalidade pode estar no curso ou na turma (ignorado quando isento)
        const effectiveMonthlyPriceCents = tuitionExemptionType
            ? null
            : (course.monthlyPriceCents ?? courseClass.monthlyPriceCents);

        const enrollment = this.createEnrollmentFromRequest(request, effectiveMonthlyPriceCents, {
            tuitionExemptionType,
            discountCents: isNonprofit ? null : request.discountCents,
            discountMonths: isNonprofit ? null : request.discountMonths
        });

        // Criar cobrança de taxa de matrícula se aplicável
        const pendingCharge = isNonprofit ? null : await this.buildEnrollmentCharge(request);

        // Salvar matrícula e cobrança
        await this.enrollments.save(enrollment);
        if (pendingCharge) {
            await this.financialCharges.save(pendingCharge);
        }

        // Aprovar solicitação
        request.approve({
            decidedByUserId: input.approverUserId,
            enrollmentId: enrollment.id,
            notes: input.notes ?? null
        });

        await this.requests.save(request);

        if (this.notifyStudent && this.outbox && this.users && this.schools) {
            this.sendEnrollmentApprovedNotifications(request, enrollment, course, courseClass).catch(() => {});
        }

        // Gerar boleto de matrícula automaticamente (se houver cobrança)
        let enrollmentFeeBoletoGenerated = false;
        if (pendingCharge && this.issueEnrollmentFeeBoleto) {
            try {
                await this.issueEnrollmentFeeBoleto.exec({
                    chargeId: pendingCharge.id,
                    requester: {
                        persona: UserPersonaEnum.STUDENT,
                        id: input.approverUserId,
                        schoolId: request.schoolId
                    }
                });
                enrollmentFeeBoletoGenerated = true;
            } catch (error) {
                // Log erro mas não falha a aprovação
                console.error('Erro ao gerar boleto de matrícula automaticamente:', error);
            }
        }

        // Gerar primeira mensalidade sempre que houver valor (não gera para aluno isento)
        let firstTuitionChargeId: string | null = null;
        if (!tuitionExemptionType && effectiveMonthlyPriceCents && effectiveMonthlyPriceCents > 0) {
            try {
                const firstTuitionCharge = await this.createFirstTuitionCharge(
                    enrollment,
                    course,
                    courseClass,
                    request.firstMonthlyPaymentDate,
                    request.discountCents,
                    request.discountMonths
                );
                if (firstTuitionCharge) {
                    firstTuitionChargeId = firstTuitionCharge.id;

                    // Gerar PIX da mensalidade automaticamente (quando disponível)
                    if (this.generateTuitionPix) {
                        try {
                            await this.generateTuitionPix.exec({
                                chargeId: firstTuitionCharge.id,
                                requester: {
                                    persona: UserPersonaEnum.STUDENT,
                                    id: input.approverUserId,
                                    schoolId: request.schoolId
                                }
                            });
                        } catch (error) {
                            // Log erro mas não falha a aprovação
                            console.error('Erro ao gerar PIX da primeira mensalidade automaticamente:', error);
                        }
                    }
                }
            } catch (error) {
                // Log erro mas não falha a aprovação
                console.error('Erro ao gerar primeira mensalidade automaticamente:', error);
            }
        }

        return {
            requestId: request.id,
            enrollmentId: enrollment.id,
            status: request.status,
            enrollmentFeeChargeId: pendingCharge ? pendingCharge.id : null,
            enrollmentFeeBoletoGenerated,
            firstTuitionChargeId
        };
    }

    private async sendEnrollmentApprovedNotifications(
        request: EnrollmentRequest,
        enrollment: Enrollment,
        course: Course,
        courseClass: CourseClass
    ): Promise<void> {
        if (!this.notifyStudent || !this.outbox || !this.users || !this.schools) return;

        const school = await this.schools.findById(request.schoolId);
        const owner = await this.users.findById(request.requestedForUserId);
        if (!school || !owner) return;

        let studentName = owner.fullName;
        if (request.requestedForDependentId && this.dependents) {
            const dep = await this.dependents.findById(request.requestedForDependentId);
            if (dep) studentName = dep.fullName;
        }

        const loginUrl = this.frontendBaseUrl ? `${this.frontendBaseUrl}/login` : undefined;

        await this.outbox.enqueue({
            type: 'send_enrollment_confirmation_email',
            aggregateId: enrollment.id,
            payload: {
                to: owner.email.value,
                studentName,
                courseName: course.name,
                schoolName: school.name,
                className: courseClass.label,
                loginUrl
            }
        });

        await this.notifyStudent.exec({
            userId: request.requestedForUserId,
            schoolId: request.schoolId,
            title: 'Matrícula confirmada',
            message: `Sua matrícula em ${course.name} (${school.name}) foi confirmada.`,
            kind: 'ENROLLMENT_CONFIRMED',
            sendPush: false,
            extraMetadata: {
                enrollmentRequestId: request.id,
                enrollmentId: enrollment.id,
                courseClassId: request.courseClassId
            }
        });
    }

    private async validateAndLoadRequest(requestId: string) {
        const request = await this.requests.findById(requestId);
        if (!request) {
            throw AppError.fromCode(ErrorCode.ENROLLMENT_REQUEST_NOT_FOUND, { requestId });
        }
        return request;
    }

    private validateRequestCanBeApproved(
        request: EnrollmentRequest,
        approverUserId: string
    ): void {
        if (request.status !== 'PENDING') {
            throw AppError.fromCode(ErrorCode.ENROLLMENT_REQUEST_ALREADY_DECIDED, {
                requestId: request.id,
                status: request.status
            });
        }

        if (request.requestedForUserId !== approverUserId) {
            throw AppError.fromCode(ErrorCode.NOT_ALLOWED, {
                message: 'Usuário não autorizado a aprovar esta solicitação de matrícula',
                requestId: request.id,
                approverUserId,
                requestedForUserId: request.requestedForUserId
            });
        }
    }

    private async ensureNoExistingEnrollment(
        courseClassId: string,
        userId: string,
        dependentId: string | null
    ): Promise<void> {
        if (dependentId) {
            const existing = await this.enrollments.findByClassAndDependent(courseClassId, dependentId);
            if (existing) {
                throw AppError.fromCode(ErrorCode.ALREADY_ENROLLED, {
                    courseClassId,
                    dependentId
                });
            }
            return;
        }

        const existing = await this.enrollments.findByClassAndUser(courseClassId, userId);
        if (existing) {
            throw AppError.fromCode(ErrorCode.ALREADY_ENROLLED, {
                courseClassId,
                userId
            });
        }
    }

    private createEnrollmentFromRequest(
        request: EnrollmentRequest,
        fullAmountCents: number | null,
        financials: {
            tuitionExemptionType: TuitionExemptionType | null;
            discountCents: number | null;
            discountMonths: number | null;
        }
    ): Enrollment {
        const enrollmentId = Uuid();
        const paymentDueDay = getUtcDay(new Date(request.firstMonthlyPaymentDate));

        if (request.requestedForDependentId) {
            return Enrollment.createForDependent({
                id: enrollmentId,
                courseClassId: request.courseClassId,
                ownerUserId: request.requestedForUserId,
                dependentId: request.requestedForDependentId,
                fullAmountCents,
                paymentDueDay,
                tuitionExemptionType: financials.tuitionExemptionType,
                discountCents: financials.discountCents,
                discountMonths: financials.discountMonths
            });
        }

        return Enrollment.createForUser({
            id: enrollmentId,
            courseClassId: request.courseClassId,
            ownerUserId: request.requestedForUserId,
            studentUserId: request.requestedForUserId,
            fullAmountCents,
            paymentDueDay,
            tuitionExemptionType: financials.tuitionExemptionType,
            discountCents: financials.discountCents,
            discountMonths: financials.discountMonths
        });
    }

    private async buildEnrollmentCharge(request: EnrollmentRequest): Promise<SchoolFinancialCharge | null> {
        if (!request.enrollmentFeeCents || request.enrollmentFeeCents <= 0) {
            return null;
        }

        const courseClass = await this.classes.findById(request.courseClassId);
        if (!courseClass) {
            throw AppError.fromCode(ErrorCode.COURSE_CLASS_NOT_FOUND, {
                courseClassId: request.courseClassId,
                requestId: request.id
            });
        }

        const course = await this.courses.findById(courseClass.courseId);
        if (!course) {
            throw AppError.fromCode(ErrorCode.COURSE_NOT_FOUND, {
                courseId: courseClass.courseId,
                requestId: request.id
            });
        }

        const dueDate = request.enrollmentFeeDueDate ?? request.firstMonthlyPaymentDate;

        // Desconto do pedido aplica-se apenas às mensalidades (createFirstTuitionCharge), não à taxa de matrícula.
        const isDependentEnrollment = request.requestedForDependentId != null;

        return SchoolFinancialCharge.create({
            id: Uuid(),
            schoolId: request.schoolId,
            ownerUserId: request.requestedForUserId,
            studentUserId: isDependentEnrollment ? null : request.requestedForUserId,
            dependentId: request.requestedForDependentId,
            courseId: courseClass.courseId,
            courseClassId: courseClass.id,
            chargeType: 'ENROLLMENT',
            description: formatEnrollmentChargeDescription(course.name),
            amountCents: request.enrollmentFeeCents,
            discountCents: null,
            discountReason: null,
            dueDate
        });
    }

    private async createFirstTuitionCharge(
        enrollment: Enrollment,
        course: import('../../../domain/entities/course').Course,
        courseClass: import('../../../domain/entities/course-class').CourseClass,
        firstMonthlyPaymentDate: Date,
        discountCents: number | null,
        discountMonths: number | null
    ): Promise<SchoolFinancialCharge | null> {
        const firstPaymentDate = toUtcDateOnly(new Date(firstMonthlyPaymentDate));

        // Verificar se já existe cobrança para este mês/ano (evita duplicata)
        if (this.financialCharges.findTuitionChargesForMonth) {
            const existingCharges = await this.financialCharges.findTuitionChargesForMonth(
                enrollment.courseClassId,
                enrollment.ownerUserId,
                enrollment.studentUserId,
                enrollment.dependentId,
                firstPaymentDate.getFullYear(),
                firstPaymentDate.getMonth() + 1
            );

            if (existingCharges.length > 0) {
                return null; // Já existe cobrança para esta data
            }
        }

        // Valor: matrícula já tem fullAmountCents (curso ou turma); fallback para curso/turma
        const monthlyPrice = enrollment.fullAmountCents ?? course.monthlyPriceCents ?? courseClass.monthlyPriceCents;
        if (!monthlyPrice || monthlyPrice <= 0) {
            return null;
        }

        // Aplicar desconto se houver e se ainda não atingiu o limite de meses
        let chargeDiscountCents: number | null = null;
        let chargeDiscountReason: string | null = null;
        if (discountCents && discountCents > 0 && discountMonths && discountMonths >= 1) {
            // Contar quantas cobranças com desconto já foram criadas para este enrollment
            const existingDiscountCount = this.financialCharges.countChargesWithDiscount
                ? await this.financialCharges.countChargesWithDiscount(
                    enrollment.courseClassId,
                    enrollment.ownerUserId,
                    enrollment.studentUserId,
                    enrollment.dependentId
                )
                : 0;

            // Aplicar desconto apenas se ainda não atingiu o limite
            if (existingDiscountCount < discountMonths) {
                chargeDiscountCents = discountCents;
                const remainingMonths = discountMonths - existingDiscountCount;
                const currentDiscountIndex = existingDiscountCount + 1;
                chargeDiscountReason = `Desconto aplicado (${currentDiscountIndex} de ${discountMonths} ${discountMonths === 1 ? 'mês' : 'meses'})`;
            }
        }

        const monthNames = [
            'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
            'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
        ];
        const monthName = monthNames[firstPaymentDate.getMonth()];
        const year = firstPaymentDate.getFullYear();

        const charge = SchoolFinancialCharge.create({
            id: Uuid(),
            schoolId: course.schoolId,
            ownerUserId: enrollment.ownerUserId,
            studentUserId: enrollment.studentUserId,
            dependentId: enrollment.dependentId,
            courseId: course.id,
            courseClassId: enrollment.courseClassId,
            chargeType: 'TUITION',
            description: `Mensalidade - ${monthName} ${year}`,
            amountCents: monthlyPrice,
            discountCents: chargeDiscountCents,
            discountReason: chargeDiscountReason,
            dueDate: firstPaymentDate
        });

        await this.financialCharges.save(charge);
        return charge;
    }
}
