import { AppDataSource } from '../../../infra/db/typeorm/datasource';
import { EnrollmentOrm } from '../../../infra/db/typeorm/entities/enrollment.orm';
import { UpdateAdminStudent } from '../admin/update-admin-student';
import type { UpdateAdminStudentInput, UpdateAdminStudentOutput } from '../admin/update-admin-student';
import { AppError, ErrorCode } from '../../../shared/errors';

export type UpdateSchoolStudentInput = UpdateAdminStudentInput & {
    schoolId: string;
    /** UUID do titular na URL; com `dependentId` edita o dependente. */
    studentId: string;
    dependentId?: string | null;
};

export class UpdateSchoolStudent {
    constructor(private readonly updateAdminStudent: UpdateAdminStudent) {}

    async exec(input: UpdateSchoolStudentInput): Promise<UpdateAdminStudentOutput> {
        const schoolId = input.schoolId.trim();
        const studentId = input.studentId.trim();
        const dependentId = input.dependentId?.trim() || null;

        if (!schoolId || !studentId) {
            throw AppError.fromCode(ErrorCode.INVALID_IDENTIFIERS, {
                message: 'schoolId e studentId são obrigatórios'
            });
        }

        const targetId = dependentId ?? studentId;
        const linked = await this.isStudentLinkedToSchool(schoolId, studentId, dependentId);
        if (!linked) {
            throw AppError.fromCode(ErrorCode.STUDENT_NOT_FOUND, {
                schoolId,
                studentId,
                dependentId
            });
        }

        const { schoolId: _s, studentId: _st, dependentId: _d, ...updateInput } = input;
        return this.updateAdminStudent.exec({
            ...updateInput,
            studentId: targetId
        });
    }

    private async isStudentLinkedToSchool(
        schoolId: string,
        studentId: string,
        dependentId: string | null
    ): Promise<boolean> {
        const repo = AppDataSource.getRepository(EnrollmentOrm);

        if (dependentId) {
            const count = await repo
                .createQueryBuilder('enrollment')
                .innerJoin('enrollment.courseClass', 'class')
                .innerJoin('class.course', 'course')
                .where('course.schoolId = :schoolId', { schoolId })
                .andWhere('enrollment.dependentId = :dependentId', { dependentId })
                .andWhere('enrollment.status = :status', { status: 'ACTIVE' })
                .getCount();
            return count > 0;
        }

        const userCount = await repo
            .createQueryBuilder('enrollment')
            .innerJoin('enrollment.courseClass', 'class')
            .innerJoin('class.course', 'course')
            .where('course.schoolId = :schoolId', { schoolId })
            .andWhere('enrollment.studentUserId = :studentId', { studentId })
            .andWhere('enrollment.status = :status', { status: 'ACTIVE' })
            .getCount();
        if (userCount > 0) return true;

        const dependentCount = await repo
            .createQueryBuilder('enrollment')
            .innerJoin('enrollment.courseClass', 'class')
            .innerJoin('class.course', 'course')
            .where('course.schoolId = :schoolId', { schoolId })
            .andWhere('enrollment.dependentId = :studentId', { studentId })
            .andWhere('enrollment.status = :status', { status: 'ACTIVE' })
            .getCount();
        return dependentCount > 0;
    }
}
