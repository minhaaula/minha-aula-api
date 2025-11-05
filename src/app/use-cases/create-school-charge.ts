import { SchoolFinancialCharge } from '../../domain/entities/school-financial-charge';
import { SchoolFinancialChargeRepository } from '../../ports/repositories/school-financial-charge.repo';
import { CourseRepository } from '../../ports/repositories/course.repo';
import { CourseClassRepository } from '../../ports/repositories/course-class.repo';
import { UserRepository } from '../../ports/repositories/user.repo';
import { DependentRepository } from '../../ports/repositories/dependent.repo';
import { Uuid } from '../../shared/uuid';
import { AppError, ErrorCode } from '../../shared/errors';
import type { CreateSchoolChargeInput } from '../types/charge.types';

export class CreateSchoolCharge {
    constructor(
        private readonly chargesRepo: SchoolFinancialChargeRepository,
        private readonly coursesRepo: CourseRepository,
        private readonly classesRepo: CourseClassRepository,
        private readonly usersRepo: UserRepository,
        private readonly dependentsRepo: DependentRepository
    ) {}

    async exec(params: CreateSchoolChargeInput): Promise<SchoolFinancialCharge> {
        const schoolId = params.schoolId.trim();
        const courseId = params.courseId.trim();
        const courseClassId = params.courseClassId?.trim() || null;
        const studentUserId = params.studentUserId?.trim() || null;
        const dependentId = params.dependentId?.trim() || null;

        // Validar que pelo menos aluno ou dependente foi informado
        this.ensureStudentOrDependentProvided(studentUserId, dependentId);

        // Validar e carregar entidades relacionadas
        const course = await this.validateAndLoadCourse(courseId, schoolId);
        await this.validateCourseClassIfProvided(courseClassId, course.id);

        // Resolver dados do aluno/dependente
        const { ownerUserId, normalizedStudentUserId, normalizedDependentId } =
            await this.resolveStudentAndDependent(studentUserId, dependentId);

        // Criar cobrança
        const charge = SchoolFinancialCharge.create({
            id: Uuid(),
            schoolId,
            ownerUserId,
            studentUserId: normalizedStudentUserId,
            dependentId: normalizedDependentId,
            courseId,
            courseClassId,
            chargeType: params.chargeType,
            description: params.description ?? null,
            amountCents: params.amountCents,
            discountCents: params.discountCents ?? null,
            discountReason: params.discountReason ?? null,
            dueDate: params.dueDate
        });

        await this.chargesRepo.save(charge);

        return charge;
    }

    private ensureStudentOrDependentProvided(
        studentUserId: string | null,
        dependentId: string | null
    ): void {
        if (!studentUserId && !dependentId) {
            throw AppError.fromCode(ErrorCode.INCOMPLETE_DATA, {
                message: 'É necessário informar o aluno ou dependente para gerar a cobrança'
            });
        }
    }

    private async validateAndLoadCourse(courseId: string, schoolId: string) {
        const course = await this.coursesRepo.findById(courseId);
        if (!course || course.schoolId !== schoolId) {
            throw AppError.fromCode(ErrorCode.COURSE_NOT_FOUND, {
                schoolId,
                courseId
            });
        }
        return course;
    }

    private async validateCourseClassIfProvided(
        courseClassId: string | null,
        courseId: string
    ): Promise<void> {
        if (!courseClassId) {
            return;
        }

        const courseClass = await this.classesRepo.findById(courseClassId);
        if (!courseClass || courseClass.courseId !== courseId) {
            throw AppError.fromCode(ErrorCode.COURSE_CLASS_NOT_FOUND, {
                courseClassId,
                courseId
            });
        }
    }

    private async resolveStudentAndDependent(
        studentUserId: string | null,
        dependentId: string | null
    ): Promise<{
        ownerUserId: string;
        normalizedStudentUserId: string | null;
        normalizedDependentId: string | null;
    }> {
        if (dependentId) {
            return this.resolveFromDependent(dependentId, studentUserId);
        }

        if (studentUserId) {
            return this.resolveFromStudent(studentUserId);
        }

        // Este caso não deveria acontecer devido à validação anterior,
        // mas mantemos para garantir type safety
        throw AppError.fromCode(ErrorCode.INVALID_IDENTIFIERS, {
            message: 'Dados de aluno inválidos'
        });
    }

    private async resolveFromDependent(
        dependentId: string,
        studentUserId: string | null
    ): Promise<{
        ownerUserId: string;
        normalizedStudentUserId: string | null;
        normalizedDependentId: string;
    }> {
        const dependent = await this.dependentsRepo.findById(dependentId);
        if (!dependent) {
            throw AppError.fromCode(ErrorCode.DEPENDENT_NOT_FOUND, { dependentId });
        }

        // Se studentUserId foi fornecido, deve ser o mesmo do dependente
        if (studentUserId && studentUserId !== dependent.userId) {
            throw AppError.fromCode(ErrorCode.BUSINESS_RULE_VIOLATION, {
                message: 'Dependente não pertence ao responsável informado',
                dependentId,
                studentUserId,
                ownerUserId: dependent.userId
            });
        }

        return {
            ownerUserId: dependent.userId,
            normalizedStudentUserId: studentUserId ? dependent.userId : null,
            normalizedDependentId: dependent.id
        };
    }

    private async resolveFromStudent(
        studentUserId: string
    ): Promise<{
        ownerUserId: string;
        normalizedStudentUserId: string;
        normalizedDependentId: null;
    }> {
        const student = await this.usersRepo.findById(studentUserId);
        if (!student) {
            throw AppError.fromCode(ErrorCode.STUDENT_NOT_FOUND, { studentUserId });
        }

        return {
            ownerUserId: student.id,
            normalizedStudentUserId: student.id,
            normalizedDependentId: null
        };
    }
}

