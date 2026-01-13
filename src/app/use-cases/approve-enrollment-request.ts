import { EnrollmentRequestRepository } from '../../ports/repositories/enrollment-request.repo';
import { EnrollmentRepository } from '../../ports/repositories/enrollment.repo';
import { CourseClassRepository } from '../../ports/repositories/course-class.repo';
import { CourseRepository } from '../../ports/repositories/course.repo';
import { SchoolFinancialChargeRepository } from '../../ports/repositories/school-financial-charge.repo';
import { AppError, ErrorCode } from '../../shared/errors';
import { Enrollment } from '../../domain/entities/enrollment';
import { EnrollmentRequest } from '../../domain/entities/enrollment-request';
import { SchoolFinancialCharge } from '../../domain/entities/school-financial-charge';
import { UserPersonaEnum } from '../../domain/value-objects/user-persona';
import { Uuid } from '../../shared/uuid';
import type { ApproveEnrollmentRequestInput, ApproveEnrollmentRequestOutput } from '../types/enrollment.types';
import type { IssueEnrollmentFeeBoleto } from './issue-enrollment-fee-boleto';
import type { GenerateTuitionPix } from './generate-tuition-pix';

export class ApproveEnrollmentRequest {
    constructor(
        private readonly requests: EnrollmentRequestRepository,
        private readonly enrollments: EnrollmentRepository,
        private readonly classes: CourseClassRepository,
        private readonly courses: CourseRepository,
        private readonly financialCharges: SchoolFinancialChargeRepository,
        private readonly issueEnrollmentFeeBoleto?: IssueEnrollmentFeeBoleto,
        private readonly generateTuitionPix?: GenerateTuitionPix
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

        // Buscar curso para obter o valor cheio
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

        // Criar matrícula com valor cheio do curso
        const enrollment = this.createEnrollmentFromRequest(request, course.monthlyPriceCents);

        // Criar cobrança de taxa de matrícula se aplicável
        const pendingCharge = await this.buildEnrollmentCharge(request);

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

        // Gerar primeira mensalidade se a data de vencimento já passou ou está no mesmo mês
        let firstTuitionChargeId: string | null = null;
        if (course.monthlyPriceCents && course.monthlyPriceCents > 0) {
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
                    
                    // Gerar PIX da mensalidade automaticamente
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

    private createEnrollmentFromRequest(request: EnrollmentRequest, fullAmountCents: number | null): Enrollment {
        const enrollmentId = Uuid();
        
        // Extrair o dia de vencimento do firstMonthlyPaymentDate
        const paymentDueDay = request.firstMonthlyPaymentDate.getDate();

        if (request.requestedForDependentId) {
            return Enrollment.createForDependent({
                id: enrollmentId,
                courseClassId: request.courseClassId,
                ownerUserId: request.requestedForUserId,
                dependentId: request.requestedForDependentId,
                fullAmountCents,
                paymentDueDay
            });
        }

        return Enrollment.createForUser({
            id: enrollmentId,
            courseClassId: request.courseClassId,
            ownerUserId: request.requestedForUserId,
            studentUserId: request.requestedForUserId,
            fullAmountCents,
            paymentDueDay
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

        const dueDate = request.enrollmentFeeDueDate ?? request.firstMonthlyPaymentDate;

        // Aplicar desconto do enrollment request se existir
        const discountCents = request.discountCents ?? null;
        const discountReason = discountCents && discountCents > 0 
            ? 'Desconto aplicado na matrícula' 
            : null;

        return SchoolFinancialCharge.create({
            id: Uuid(),
            schoolId: request.schoolId,
            ownerUserId: request.requestedForUserId,
            studentUserId: request.requestedForUserId,
            dependentId: request.requestedForDependentId,
            courseId: courseClass.courseId,
            courseClassId: courseClass.id,
            chargeType: 'ENROLLMENT',
            description: 'Enrollment fee',
            amountCents: request.enrollmentFeeCents,
            discountCents,
            discountReason,
            dueDate
        });
    }

    private async createFirstTuitionCharge(
        enrollment: Enrollment,
        course: import('../../domain/entities/course').Course,
        courseClass: import('../../domain/entities/course-class').CourseClass,
        firstMonthlyPaymentDate: Date,
        discountCents: number | null,
        discountMonths: number | null
    ): Promise<SchoolFinancialCharge | null> {
        const now = new Date();
        const firstPaymentDate = new Date(firstMonthlyPaymentDate);
        
        // Só criar se a data de vencimento já passou ou está no mesmo mês
        const isSameMonth = firstPaymentDate.getMonth() === now.getMonth() && 
                           firstPaymentDate.getFullYear() === now.getFullYear();
        const isPast = firstPaymentDate < now;
        
        if (!isSameMonth && !isPast) {
            return null; // Ainda não é hora de gerar
        }

        // Verificar se já existe cobrança para este mês/ano
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
                return null; // Já existe cobrança
            }
        }

        const monthNames = [
            'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
            'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
        ];
        const monthName = monthNames[firstPaymentDate.getMonth()];
        const year = firstPaymentDate.getFullYear();

        // Garantir que amountCents seja um número válido
        const monthlyPrice = enrollment.fullAmountCents ?? course.monthlyPriceCents;
        if (!monthlyPrice || monthlyPrice <= 0) {
            return null; // Não criar cobrança se não houver preço definido
        }

        // Aplicar desconto se houver e se este é um dos primeiros meses
        let chargeDiscountCents: number | null = null;
        let chargeDiscountReason: string | null = null;
        if (discountCents && discountCents > 0 && discountMonths && discountMonths >= 1) {
            // A primeira mensalidade sempre recebe desconto se houver
            chargeDiscountCents = discountCents;
            chargeDiscountReason = `Desconto aplicado (${discountMonths} ${discountMonths === 1 ? 'mês' : 'meses'})`;
        }

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
