import { CourseRepository } from '../../ports/repositories/course.repo';
import { CourseClassRepository } from '../../ports/repositories/course-class.repo';
import { UserRepository } from '../../ports/repositories/user.repo';
import { DependentRepository } from '../../ports/repositories/dependent.repo';
import { EnrollmentRepository } from '../../ports/repositories/enrollment.repo';
import { Enrollment } from '../../domain/entities/enrollment';
import { Uuid } from '../../shared/uuid';
import { equalUuid } from '../../shared/normalize-uuid';
import { AppError, ErrorCode } from '../../shared/errors';
import type { EnrollStudentInput, EnrollStudentOutput } from '../types/enrollment.types';

export class EnrollStudent {
    constructor(
        private readonly courses: CourseRepository,
        private readonly classes: CourseClassRepository,
        private readonly users: UserRepository,
        private readonly dependents: DependentRepository,
        private readonly enrollments: EnrollmentRepository
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

        // Criar matrícula
        const enrollment = this.createEnrollment(courseClass.id, owner.id, dependentId);

        await this.enrollments.save(enrollment);

        return {
            id: enrollment.id,
            courseClassId: enrollment.courseClassId,
            ownerUserId: enrollment.ownerUserId,
            studentType: enrollment.studentType,
            studentUserId: enrollment.studentUserId,
            dependentId: enrollment.dependentId,
            status: enrollment.status,
            enrolledAt: enrollment.enrolledAt,
            updatedAt: enrollment.updatedAt
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
        dependentId: string | null
    ): Enrollment {
        if (dependentId) {
            return Enrollment.createForDependent({
                id: Uuid(),
                courseClassId,
                ownerUserId,
                dependentId
            });
        }

        return Enrollment.createForUser({
            id: Uuid(),
            courseClassId,
            ownerUserId,
            studentUserId: ownerUserId
        });
    }
}
