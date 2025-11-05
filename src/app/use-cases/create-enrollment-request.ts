import { SchoolRepository } from '../../ports/repositories/school.repo';
import { CourseRepository } from '../../ports/repositories/course.repo';
import { CourseClassRepository } from '../../ports/repositories/course-class.repo';
import { UserRepository } from '../../ports/repositories/user.repo';
import { DependentRepository } from '../../ports/repositories/dependent.repo';
import { EnrollmentRepository } from '../../ports/repositories/enrollment.repo';
import { EnrollmentRequestRepository } from '../../ports/repositories/enrollment-request.repo';
import { EnrollmentRequest } from '../../domain/entities/enrollment-request';
import { Uuid } from '../../shared/uuid';
import { equalUuid } from '../../shared/normalize-uuid';
import { AppError, ErrorCode } from '../../shared/errors';
import { normalizeDateString, normalizeOptionalDateString } from '../utils/date.utils';
import type { CreateEnrollmentRequestInput } from '../types/enrollment.types';

export class CreateEnrollmentRequest {
    constructor(
        private readonly schools: SchoolRepository,
        private readonly courses: CourseRepository,
        private readonly classes: CourseClassRepository,
        private readonly users: UserRepository,
        private readonly dependents: DependentRepository,
        private readonly enrollments: EnrollmentRepository,
        private readonly requests: EnrollmentRequestRepository
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

        // Verificar se já existe matrícula
        await this.ensureNoExistingEnrollment(courseClass.id, user.id, dependentId);

        // Verificar se já existe solicitação
        await this.ensureNoExistingRequest(courseClass.id, user.id, dependentId);

        // Normalizar valores monetários
        const discountCents = this.normalizeAmount(input.discount, 'discount');
        const enrollmentFeeCents = this.normalizeAmount(input.enrollmentFeeAmount, 'enrollment fee');

        // Normalizar datas
        const enrollmentFeeDueDate = this.normalizeEnrollmentFeeDueDate(
            input.enrollmentFeeDueDate,
            enrollmentFeeCents
        );
        const firstMonthlyPaymentDate = normalizeDateString(
            input.firstMonthlyPaymentDate,
            'first monthly payment date'
        );

        // Criar solicitação
        const request = EnrollmentRequest.create({
            id: Uuid(),
            schoolId: school.id,
            courseClassId: courseClass.id,
            requestedForUserId: user.id,
            requestedForDependentId: dependentId,
            notes: input.notes ?? null,
            discountCents,
            enrollmentFeeCents,
            enrollmentFeeDueDate,
            firstMonthlyPaymentDate
        });

        await this.requests.save(request);

        return request;
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
            throw AppError.fromCode(ErrorCode.USER_NOT_FOUND, { userId });
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
        if (!dependent || dependent.userId !== ownerUserId) {
            throw AppError.fromCode(ErrorCode.DEPENDENT_NOT_FOUND, {
                message: 'Dependente não encontrado para o usuário informado',
                dependentId,
                ownerUserId
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

    private async ensureNoExistingRequest(
        courseClassId: string,
        userId: string,
        dependentId: string | null
    ): Promise<void> {
        const existingRequest = await this.requests.findByCourseClassAndTarget({
            courseClassId,
            userId,
            dependentId
        });

        if (existingRequest) {
            throw AppError.fromCode(ErrorCode.ENROLLMENT_REQUEST_ALREADY_EXISTS, {
                courseClassId,
                userId,
                dependentId
            });
        }
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
}
