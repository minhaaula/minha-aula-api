import { SchoolFinancialCharge, SchoolFinancialChargeType } from '../../domain/entities/school-financial-charge';
import { SchoolFinancialChargeRepository } from '../../ports/repositories/school-financial-charge.repo';
import { CourseRepository } from '../../ports/repositories/course.repo';
import { CourseClassRepository } from '../../ports/repositories/course-class.repo';
import { UserRepository } from '../../ports/repositories/user.repo';
import { DependentRepository } from '../../ports/repositories/dependent.repo';
import { Uuid } from '../../shared/uuid';
import { AppError, ErrorCode } from '../../shared/errors';

export class CreateSchoolCharge {
    constructor(
        private readonly chargesRepo: SchoolFinancialChargeRepository,
        private readonly coursesRepo: CourseRepository,
        private readonly classesRepo: CourseClassRepository,
        private readonly usersRepo: UserRepository,
        private readonly dependentsRepo: DependentRepository
    ) {}

    async exec(params: {
        schoolId: string;
        courseId: string;
        courseClassId?: string | null;
        studentUserId?: string | null;
        dependentId?: string | null;
        chargeType: SchoolFinancialChargeType;
        description?: string | null;
        amountCents: number;
        discountCents?: number | null;
        discountReason?: string | null;
        dueDate: Date;
    }): Promise<SchoolFinancialCharge> {
        const schoolId = params.schoolId.trim();
        const courseId = params.courseId.trim();
        const courseClassId = params.courseClassId?.trim() || null;
        const studentUserId = params.studentUserId?.trim() || null;
        const dependentId = params.dependentId?.trim() || null;

        if (!studentUserId && !dependentId) {
            throw AppError.fromCode(ErrorCode.INCOMPLETE_DATA, {
                message: 'É necessário informar o aluno ou dependente para gerar a cobrança'
            });
        }

        const course = await this.coursesRepo.findById(courseId);
        if (!course || course.schoolId !== schoolId) {
            throw AppError.fromCode(ErrorCode.COURSE_NOT_FOUND, {
                schoolId,
                courseId
            });
        }

        if (courseClassId) {
            const courseClass = await this.classesRepo.findById(courseClassId);
            if (!courseClass || courseClass.courseId !== course.id) {
                throw AppError.fromCode(ErrorCode.COURSE_CLASS_NOT_FOUND, {
                    courseClassId,
                    courseId
                });
            }
        }

        let ownerUserId: string;
        let normalizedStudentUserId: string | null = null;
        let normalizedDependentId: string | null = null;

        if (dependentId) {
            const dependent = await this.dependentsRepo.findById(dependentId);
            if (!dependent) {
                throw AppError.fromCode(ErrorCode.DEPENDENT_NOT_FOUND, { dependentId });
            }
            ownerUserId = dependent.userId;
            normalizedDependentId = dependent.id;

            if (studentUserId && studentUserId !== dependent.userId) {
                throw AppError.fromCode(ErrorCode.BUSINESS_RULE_VIOLATION, {
                    message: 'Dependente não pertence ao responsável informado'
                });
            }

            normalizedStudentUserId = studentUserId ? dependent.userId : null;
        } else if (studentUserId) {
            const student = await this.usersRepo.findById(studentUserId);
            if (!student) {
                throw AppError.fromCode(ErrorCode.STUDENT_NOT_FOUND, { studentUserId });
            }
            ownerUserId = student.id;
            normalizedStudentUserId = student.id;
        } else {
            throw AppError.fromCode(ErrorCode.INVALID_IDENTIFIERS, {
                message: 'Dados de aluno inválidos'
            });
        }

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
}

