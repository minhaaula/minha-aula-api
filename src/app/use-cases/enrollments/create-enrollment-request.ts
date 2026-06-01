import { SchoolRepository } from '../../../ports/repositories/school.repo';
import { CourseRepository } from '../../../ports/repositories/course.repo';
import { CourseClassRepository } from '../../../ports/repositories/course-class.repo';
import { UserRepository } from '../../../ports/repositories/user.repo';
import { DependentRepository } from '../../../ports/repositories/dependent.repo';
import { EnrollmentRepository } from '../../../ports/repositories/enrollment.repo';
import { EnrollmentRequestRepository } from '../../../ports/repositories/enrollment-request.repo';
import { OutboxRepository } from '../../../ports/repositories/outbox.repo';
import { EnrollmentRequest } from '../../../domain/entities/enrollment-request';
import { Uuid } from '../../../shared/uuid';
import { equalUuid } from '../../../shared/normalize-uuid';
import { AppError, ErrorCode } from '../../../shared/errors';
import { normalizeDateString } from '../../utils/date.utils';
import type { TuitionExemptionType } from '../../../domain/value-objects/tuition-exemption-type';
import { resolveNonprofitTuitionExemptionType } from '../../../shared/nonprofit-school';
import type { CreateEnrollmentRequestInput } from '../../types/enrollment.types';
import type { NotifyStudentUser } from '../shared/notify-student-user';

export class CreateEnrollmentRequest {
    constructor(
        private readonly schools: SchoolRepository,
        private readonly courses: CourseRepository,
        private readonly classes: CourseClassRepository,
        private readonly users: UserRepository,
        private readonly dependents: DependentRepository,
        private readonly enrollments: EnrollmentRepository,
        private readonly requests: EnrollmentRequestRepository,
        private readonly notifyStudent?: NotifyStudentUser,
        private readonly outbox?: OutboxRepository,
        private readonly frontendBaseUrl?: string
    ) {}

    async exec(input: CreateEnrollmentRequestInput): Promise<EnrollmentRequest> {
        const schoolId = input.schoolId.trim();
        const courseClassId = input.courseClassId.trim();

        // Validar e carregar entidades relacionadas
        const school = await this.validateAndLoadSchool(schoolId);
        const courseClass = await this.validateAndLoadCourseClass(courseClassId);
        const course = await this.validateCourseBelongsToSchool(courseClass.courseId, school.id);
        const user = await this.validateAndLoadUser(input.requestedForUserId);

        // Validar dependente se fornecido
        const dependentId = await this.validateDependentIfProvided(
            input.requestedForDependentId,
            user.id,
            courseClass.id
        );

        // Verificar se já existe matrícula ativa/pendente
        await this.ensureNoExistingEnrollment(courseClass.id, user.id, dependentId);

        const isNonprofit = school.isNonprofitAssociation;
        const tuitionExemptionType = resolveNonprofitTuitionExemptionType(
            isNonprofit,
            input.tuitionExemptionType
        );

        // Normalizar valores monetários (sem fins lucrativos: sem taxa nem desconto)
        const discountCents = isNonprofit
            ? null
            : this.normalizeAmount(input.discount, 'discount');
        const discountMonths = isNonprofit
            ? null
            : this.normalizeDiscountMonths(input.discountMonths, discountCents);
        const enrollmentFeeCents = isNonprofit
            ? null
            : this.normalizeAmount(input.enrollmentFeeAmount, 'enrollment fee');

        // Normalizar datas
        const enrollmentFeeDueDate = this.normalizeEnrollmentFeeDueDate(
            input.enrollmentFeeDueDate,
            enrollmentFeeCents
        );
        const firstMonthlyPaymentDate = this.resolveFirstMonthlyPaymentDate(
            input.firstMonthlyPaymentDate,
            tuitionExemptionType
        );

        if (this.requests.findPendingByCourseClassAndTarget) {
            const pending = await this.requests.findPendingByCourseClassAndTarget({
                courseClassId: courseClass.id,
                userId: user.id,
                dependentId
            });
            if (pending) {
                throw AppError.fromCode(ErrorCode.ENROLLMENT_REQUEST_ALREADY_EXISTS, {
                    courseClassId: courseClass.id,
                    userId: user.id,
                    dependentId
                });
            }
        }

        const request = EnrollmentRequest.create({
            id: Uuid(),
            schoolId: school.id,
            courseClassId: courseClass.id,
            requestedForUserId: user.id,
            requestedForDependentId: dependentId,
            notes: input.notes ?? null,
            discountCents,
            discountMonths,
            enrollmentFeeCents,
            enrollmentFeeDueDate,
            firstMonthlyPaymentDate,
            tuitionExemptionType
        });

        await this.requests.save(request);

        if (input.initiatedBySchool && this.notifyStudent && this.outbox) {
            await this.notifyEnrollmentRequestFromSchool(request).catch(() => {});
        }

        return request;
    }

    private async notifyEnrollmentRequestFromSchool(request: EnrollmentRequest): Promise<void> {
        if (!this.notifyStudent || !this.outbox) return;

        const school = await this.schools.findById(request.schoolId);
        const courseClass = await this.classes.findById(request.courseClassId);
        if (!courseClass) return;
        const course = await this.courses.findById(courseClass.courseId);
        const user = await this.users.findById(request.requestedForUserId);
        if (!school || !course || !user) return;

        const dependent = request.requestedForDependentId
            ? await this.dependents.findById(request.requestedForDependentId)
            : null;
        const studentName = dependent?.fullName ?? user.fullName;
        const targetLabel = dependent ? ` (${dependent.fullName})` : '';

        const title = 'Novo pedido de matrícula';
        const message = `${school.name} enviou um pedido de matrícula em ${course.name} — ${courseClass.label}${targetLabel}.`;

        await this.notifyStudent.exec({
            userId: request.requestedForUserId,
            schoolId: request.schoolId,
            title,
            message,
            kind: 'ENROLLMENT_REQUEST_RECEIVED',
            sendPush: true,
            extraMetadata: {
                enrollmentRequestId: request.id,
                courseClassId: request.courseClassId
            }
        });

        const loginUrl = this.frontendBaseUrl ? `${this.frontendBaseUrl}/login` : undefined;
        await this.outbox.enqueue({
            type: 'send_enrollment_request_received_email',
            aggregateId: request.id,
            payload: {
                to: user.email.value,
                studentName,
                schoolName: school.name,
                courseName: course.name,
                className: courseClass.label,
                loginUrl
            }
        });

        const cursoLabel = `${course.name} — ${courseClass.label}`.trim();
        await this.outbox.enqueue({
            type: 'whatsapp_notification',
            aggregateId: request.id,
            payload: {
                userIds: [request.requestedForUserId],
                solicitacaoMatricula: {
                    nome: user.fullName.trim(),
                    escola: school.name.trim(),
                    curso: cursoLabel,
                    aluno: studentName.trim()
                }
            }
        });
    }

    private async validateAndLoadSchool(schoolId: string) {
        const school = await this.schools.findById(schoolId);
        if (!school) {
            throw AppError.fromCode(ErrorCode.SCHOOL_NOT_FOUND, { schoolId });
        }
        return school;
    }

    private async validateAndLoadCourseClass(courseClassId: string) {
        const courseClass = await this.classes.findById(courseClassId);
        if (!courseClass) {
            throw AppError.fromCode(ErrorCode.COURSE_CLASS_NOT_FOUND, { courseClassId });
        }
        return courseClass;
    }

    private async validateCourseBelongsToSchool(courseId: string, schoolId: string) {
        const course = await this.courses.findById(courseId);
        if (!course || !equalUuid(course.schoolId, schoolId)) {
            throw AppError.fromCode(ErrorCode.BUSINESS_RULE_VIOLATION, {
                message: 'Turma não pertence à escola informada'
            });
        }
        return course;
    }

    private async validateAndLoadUser(userId: string) {
        const user = await this.users.findById(userId);
        if (!user) {
            // Verificar se o ID é de um dependente para dar uma mensagem mais clara
            const dependent = await this.dependents.findById(userId);
            if (dependent) {
                throw AppError.fromCode(ErrorCode.USER_NOT_FOUND, { 
                    userId,
                    message: `O ID informado (${userId}) é de um dependente, não de um usuário. Para matricular um dependente, o campo 'requestedForUserId' deve conter o ID do responsável (pai/mãe), não o ID do dependente. Use o ID do responsável: ${dependent.userId}`
                });
            }
            
            throw AppError.fromCode(ErrorCode.USER_NOT_FOUND, { 
                userId,
                message: 'O usuário informado não foi encontrado. Verifique se o ID está correto e se o usuário existe no sistema.'
            });
        }
        return user;
    }

    private async validateDependentIfProvided(
        dependentId: string | null | undefined,
        ownerUserId: string,
        courseClassId: string
    ): Promise<string | null> {
        if (!dependentId) {
            return null;
        }

        const dependent = await this.dependents.findById(dependentId);
        if (!dependent) {
            throw AppError.fromCode(ErrorCode.DEPENDENT_NOT_FOUND, {
                message: 'Dependente não encontrado. Verifique se o ID do dependente está correto.',
                dependentId,
                ownerUserId
            });
        }
        
        if (dependent.userId !== ownerUserId) {
            throw AppError.fromCode(ErrorCode.DEPENDENT_NOT_FOUND, {
                message: 'O dependente informado não pertence ao usuário responsável. O requestedForUserId deve ser o ID do responsável (pai/mãe), não do dependente.',
                dependentId,
                ownerUserId,
                actualOwnerId: dependent.userId
            });
        }

        // Verificar se dependente já está matriculado
        const existingEnrollment = await this.enrollments.findByClassAndDependent(
            courseClassId,
            dependent.id
        );
        if (existingEnrollment) {
            throw AppError.fromCode(ErrorCode.ALREADY_ENROLLED, {
                courseClassId,
                dependentId: dependent.id
            });
        }

        return dependent.id;
    }

    private async ensureNoExistingEnrollment(
        courseClassId: string,
        userId: string,
        dependentId: string | null
    ): Promise<void> {
        if (dependentId) {
            // Já validado em validateDependentIfProvided
            return;
        }

        const existingEnrollment = await this.enrollments.findByClassAndUser(courseClassId, userId);
        if (existingEnrollment) {
            throw AppError.fromCode(ErrorCode.ALREADY_ENROLLED, {
                courseClassId,
                userId
            });
        }
    }

    private resolveFirstMonthlyPaymentDate(
        value: string | undefined,
        tuitionExemptionType: TuitionExemptionType | null
    ): Date {
        const trimmed = value?.trim();
        if (trimmed) {
            return normalizeDateString(trimmed, 'first monthly payment date');
        }
        if (tuitionExemptionType) {
            return normalizeDateString(new Date().toISOString().slice(0, 10), 'first monthly payment date');
        }
        throw AppError.fromCode(ErrorCode.VALIDATION_ERROR, {
            message:
                'firstMonthlyPaymentDate é obrigatório quando a matrícula não é isenta (com tuitionExempt true o campo é opcional)'
        });
    }

    private normalizeAmount(value: number | null | undefined, fieldName: string): number | null {
        if (value === undefined || value === null) {
            return null;
        }

        const amount = Number(value);
        if (!Number.isFinite(amount) || amount < 0) {
            throw AppError.fromCode(ErrorCode.INVALID_AMOUNT, {
                message: `Valor inválido para ${fieldName}`,
                value
            });
        }

        return Math.round(amount * 100);
    }

    private normalizeEnrollmentFeeDueDate(
        dateValue: string | null | undefined,
        enrollmentFeeCents: number | null
    ): Date | null {
        if (dateValue === undefined || dateValue === null) {
            return null;
        }

        if (enrollmentFeeCents === null) {
            throw AppError.fromCode(ErrorCode.VALIDATION_ERROR, {
                message: 'Data de vencimento da taxa de matrícula requer um valor de taxa'
            });
        }

        return normalizeDateString(dateValue, 'enrollment fee due date');
    }

    private normalizeDiscountMonths(
        value: number | null | undefined,
        discountCents: number | null
    ): number | null {
        // Se não há desconto, discountMonths deve ser null
        if (discountCents === null || discountCents === 0) {
            return null;
        }

        // Se há desconto, discountMonths é obrigatório
        if (value === undefined || value === null) {
            throw AppError.fromCode(ErrorCode.VALIDATION_ERROR, {
                message: 'discountMonths é obrigatório quando há desconto (discount > 0)'
            });
        }

        const months = Number(value);
        if (!Number.isInteger(months) || months < 1) {
            throw AppError.fromCode(ErrorCode.VALIDATION_ERROR, {
                message: 'discountMonths deve ser um número inteiro positivo (1, 2, 3, etc.)'
            });
        }

        return months;
    }
}
