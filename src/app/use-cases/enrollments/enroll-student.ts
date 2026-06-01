import { CourseRepository } from '../../../ports/repositories/course.repo';
import { CourseClassRepository } from '../../../ports/repositories/course-class.repo';
import { SchoolRepository } from '../../../ports/repositories/school.repo';
import { UserRepository } from '../../../ports/repositories/user.repo';
import { DependentRepository } from '../../../ports/repositories/dependent.repo';
import { EnrollmentRepository } from '../../../ports/repositories/enrollment.repo';
import { OutboxRepository } from '../../../ports/repositories/outbox.repo';
import { Uuid } from '../../../shared/uuid';
import { equalUuid } from '../../../shared/normalize-uuid';
import { AppError, ErrorCode } from '../../../shared/errors';
import type { EnrollStudentInput, EnrollStudentOutput } from '../../types/enrollment.types';
import type { NotifyStudentUser } from '../shared/notify-student-user';
import { Enrollment } from '../../../domain/entities/enrollment';
import type { TuitionExemptionType } from '../../../domain/value-objects/tuition-exemption-type';
import { presentTuitionExemption } from '../../presenters/tuition-exemption.presenter';
import { resolveNonprofitTuitionExemptionType } from '../../../shared/nonprofit-school';

export class EnrollStudent {
    constructor(
        private readonly courses: CourseRepository,
        private readonly classes: CourseClassRepository,
        private readonly users: UserRepository,
        private readonly dependents: DependentRepository,
        private readonly enrollments: EnrollmentRepository,
        private readonly schools?: SchoolRepository,
        private readonly outbox?: OutboxRepository,
        private readonly frontendBaseUrl?: string,
        private readonly notifyStudent?: NotifyStudentUser
    ) {}

    async exec(input: EnrollStudentInput): Promise<EnrollStudentOutput> {
        const schoolId = input.schoolId.trim();
        const courseId = input.courseId.trim();
        const classId = input.classId.trim();
        const studentUserId = input.studentUserId.trim();
        const dependentId = input.dependentId?.trim() || null;

        // Validar dados obrigatórios
        this.validateRequiredFields(schoolId, courseId, classId, studentUserId);

        // Validar e carregar entidades relacionadas
        const course = await this.validateAndLoadCourse(courseId, schoolId);
        const courseClass = await this.validateAndLoadCourseClass(classId, course.id);
        const owner = await this.validateAndLoadUser(studentUserId);

        // Validar dependente se fornecido e verificar se já está matriculado
        await this.validateDependentIfProvided(dependentId, owner.id, courseClass.id);

        // Verificar se usuário já está matriculado (se não for dependente)
        await this.ensureNoExistingEnrollment(courseClass.id, owner.id, dependentId);

        const school = this.schools ? await this.schools.findById(course.schoolId) : null;
        const isNonprofit = school?.isNonprofitAssociation === true;
        const tuitionExemptionType = resolveNonprofitTuitionExemptionType(
            isNonprofit,
            input.tuitionExemptionType
        );
        const monthlyPriceCents = tuitionExemptionType ? null : course.monthlyPriceCents;
        const discountCents =
            tuitionExemptionType || !input.discount
                ? null
                : Math.round(input.discount * 100);
        const discountMonths =
            tuitionExemptionType || !discountCents ? null : (input.discountMonths ?? null);

        const enrollment = this.createEnrollment(
            courseClass.id,
            owner.id,
            dependentId,
            monthlyPriceCents,
            tuitionExemptionType,
            discountCents,
            discountMonths
        );

        await this.enrollments.save(enrollment);

        // Enfileira email de confirmação de matrícula (processado pelo worker quando o módulo admin está ativo)
        if (this.outbox && this.schools && school) {
            const studentName = dependentId
                    ? ((await this.dependents.findById(dependentId))?.fullName ?? owner.fullName)
                    : owner.fullName;
                const to = owner.email.value;
                this.outbox
                    .enqueue({
                        type: 'send_enrollment_confirmation_email',
                        aggregateId: enrollment.id,
                        payload: {
                            to,
                            studentName,
                            courseName: course.name,
                            schoolName: school.name,
                            className: courseClass.label,
                            loginUrl: this.frontendBaseUrl ? `${this.frontendBaseUrl}/login` : undefined
                        }
                    })
                    .catch(() => {});

                if (this.notifyStudent) {
                    this.notifyStudent
                        .exec({
                            userId: owner.id,
                            schoolId: schoolId,
                            title: 'Matrícula confirmada',
                            message: `Sua matrícula em ${course.name} (${school.name}) foi confirmada.`,
                            kind: 'ENROLLMENT_CONFIRMED',
                            sendPush: false,
                            extraMetadata: {
                                enrollmentId: enrollment.id,
                                courseClassId: enrollment.courseClassId
                            }
                        })
                        .catch(() => {});
                }
        }

        const exemption = presentTuitionExemption(enrollment.tuitionExemptionType);

        return {
            id: enrollment.id,
            courseClassId: enrollment.courseClassId,
            ownerUserId: enrollment.ownerUserId,
            studentType: enrollment.studentType,
            studentUserId: enrollment.studentUserId,
            dependentId: enrollment.dependentId,
            status: enrollment.status,
            enrolledAt: enrollment.enrolledAt,
            updatedAt: enrollment.updatedAt,
            tuitionExempt: exemption.tuitionExempt,
            tuitionExemptionType: exemption.tuitionExemptionType
        };
    }

    private validateRequiredFields(
        schoolId: string,
        courseId: string,
        classId: string,
        studentUserId: string
    ): void {
        if (!schoolId || !courseId || !classId || !studentUserId) {
            throw AppError.fromCode(ErrorCode.INVALID_IDENTIFIERS, {
                message: 'Dados de matrícula incompletos'
            });
        }
    }

    private async validateAndLoadCourse(courseId: string, schoolId: string) {
        const course = await this.courses.findById(courseId);
        if (!course || !course.isActive || !equalUuid(course.schoolId, schoolId)) {
            throw AppError.fromCode(ErrorCode.COURSE_NOT_FOUND, {
                courseId,
                schoolId,
                message: 'Curso não encontrado para esta escola ou está inativo'
            });
        }
        return course;
    }

    private async validateAndLoadCourseClass(classId: string, courseId: string) {
        const courseClass = await this.classes.findById(classId);
        if (!courseClass || !courseClass.isActive || !equalUuid(courseClass.courseId, courseId)) {
            throw AppError.fromCode(ErrorCode.COURSE_CLASS_NOT_FOUND, {
                classId,
                courseId,
                message: 'Turma não encontrada para este curso ou está inativa'
            });
        }
        return courseClass;
    }

    private async validateAndLoadUser(userId: string) {
        const user = await this.users.findById(userId);
        if (!user) {
            throw AppError.fromCode(ErrorCode.USER_NOT_FOUND, { userId });
        }
        return user;
    }

    private async validateDependentIfProvided(
        dependentId: string | null,
        ownerUserId: string,
        courseClassId: string
    ): Promise<void> {
        if (!dependentId) {
            return;
        }

        const dependent = await this.dependents.findById(dependentId);
        if (!dependent || !equalUuid(dependent.userId, ownerUserId)) {
            throw AppError.fromCode(ErrorCode.DEPENDENT_NOT_FOUND, {
                dependentId,
                ownerUserId,
                message: 'Dependente não encontrado para este aluno'
            });
        }

        // Verificar se dependente já está matriculado
        const existing = await this.enrollments.findByClassAndDependent(courseClassId, dependent.id);
        if (existing) {
            throw AppError.fromCode(ErrorCode.ALREADY_ENROLLED, {
                courseClassId,
                dependentId: dependent.id
            });
        }
    }

    private async ensureNoExistingEnrollment(
        courseClassId: string,
        userId: string,
        dependentId: string | null
    ): Promise<void> {
        // Se for dependente, já foi validado em validateDependentIfProvided
        if (dependentId) {
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

    private createEnrollment(
        courseClassId: string,
        ownerUserId: string,
        dependentId: string | null,
        fullAmountCents: number | null,
        tuitionExemptionType: TuitionExemptionType | null,
        discountCents: number | null,
        discountMonths: number | null
    ): Enrollment {
        const paymentDueDay = 10;

        if (dependentId) {
            return Enrollment.createForDependent({
                id: Uuid(),
                courseClassId,
                ownerUserId,
                dependentId,
                fullAmountCents,
                paymentDueDay,
                tuitionExemptionType,
                discountCents,
                discountMonths
            });
        }

        return Enrollment.createForUser({
            id: Uuid(),
            courseClassId,
            ownerUserId,
            studentUserId: ownerUserId,
            fullAmountCents,
            paymentDueDay,
            tuitionExemptionType,
            discountCents,
            discountMonths
        });
    }
}
