import { UserRepository } from '../../ports/repositories/user.repo';
import { DependentRepository } from '../../ports/repositories/dependent.repo';
import { AppDataSource } from '../../infra/db/typeorm/datasource';
import { EnrollmentOrm } from '../../infra/db/typeorm/entities/enrollment.orm';
import { AppError, ErrorCode } from '../../shared/errors';

export interface ListAdminStudentCoursesInput {
    schoolId: string;
    studentId: string;
}

export type CourseEnrollmentItem = {
    id: string;
    course: { id: string; name: string };
    class: { id: string; label: string };
    enrolledAt: Date;
    status: string;
};

export type DependentCoursesItem = {
    dependentId: string;
    dependentName: string;
    courses: CourseEnrollmentItem[];
};

export interface ListAdminStudentCoursesOutput {
    student: {
        studentId: string;
        studentName: string;
        studentType: 'USER' | 'DEPENDENT';
    };
    courses: CourseEnrollmentItem[];
    dependents: DependentCoursesItem[];
}

export class ListAdminStudentCourses {
    constructor(
        private readonly users: UserRepository,
        private readonly dependents: DependentRepository
    ) {}

    async exec(input: ListAdminStudentCoursesInput): Promise<ListAdminStudentCoursesOutput | null> {
        const schoolId = input.schoolId.trim();
        const studentId = input.studentId.trim();

        if (!schoolId || !studentId) {
            throw AppError.fromCode(ErrorCode.INVALID_IDENTIFIERS, {
                message: 'schoolId e studentId são obrigatórios'
            });
        }

        const enrollmentRepo = AppDataSource.getRepository(EnrollmentOrm);

        // Aluno é usuário (titular)?
        const user = await this.users.findById(studentId);
        if (user) {
            const hasEnrollment = await this.checkUserEnrollmentInSchool(enrollmentRepo, schoolId, studentId);
            if (!hasEnrollment) {
                return null;
            }
            const courses = await this.findEnrollmentsForUser(enrollmentRepo, schoolId, studentId);
            const dependentsList = await this.dependents.findByUserIds([studentId]);
            const dependents: DependentCoursesItem[] = [];

            for (const dep of dependentsList) {
                const depCourses = await this.findEnrollmentsForDependent(enrollmentRepo, schoolId, dep.id);
                if (depCourses.length > 0) {
                    dependents.push({
                        dependentId: dep.id,
                        dependentName: dep.fullName,
                        courses: depCourses
                    });
                }
            }

            return {
                student: {
                    studentId: user.id,
                    studentName: user.fullName,
                    studentType: 'USER'
                },
                courses,
                dependents
            };
        }

        // Aluno é dependente?
        const dependent = await this.dependents.findById(studentId);
        if (!dependent) {
            return null;
        }

        const hasEnrollment = await this.checkDependentEnrollmentInSchool(enrollmentRepo, schoolId, studentId);
        if (!hasEnrollment) {
            return null;
        }

        const courses = await this.findEnrollmentsForDependent(enrollmentRepo, schoolId, dependent.id);

        return {
            student: {
                studentId: dependent.id,
                studentName: dependent.fullName,
                studentType: 'DEPENDENT'
            },
            courses,
            dependents: []
        };
    }

    private async checkUserEnrollmentInSchool(
        repo: ReturnType<typeof AppDataSource.getRepository<EnrollmentOrm>>,
        schoolId: string,
        userId: string
    ): Promise<boolean> {
        const count = await repo
            .createQueryBuilder('enrollment')
            .innerJoin('enrollment.courseClass', 'class')
            .innerJoin('class.course', 'course')
            .where('course.schoolId = :schoolId', { schoolId })
            .andWhere('enrollment.studentUserId = :userId', { userId })
            .andWhere('enrollment.status = :status', { status: 'ACTIVE' })
            .getCount();
        return count > 0;
    }

    private async checkDependentEnrollmentInSchool(
        repo: ReturnType<typeof AppDataSource.getRepository<EnrollmentOrm>>,
        schoolId: string,
        dependentId: string
    ): Promise<boolean> {
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

    private async findEnrollmentsForUser(
        repo: ReturnType<typeof AppDataSource.getRepository<EnrollmentOrm>>,
        schoolId: string,
        userId: string
    ): Promise<CourseEnrollmentItem[]> {
        const rows = await repo
            .createQueryBuilder('enrollment')
            .innerJoin('enrollment.courseClass', 'class')
            .innerJoin('class.course', 'course')
            .where('course.schoolId = :schoolId', { schoolId })
            .andWhere('enrollment.studentUserId = :userId', { userId })
            .select([
                'enrollment.id',
                'enrollment.enrolledAt',
                'enrollment.status',
                'course.id',
                'course.name',
                'class.id',
                'class.label'
            ])
            .orderBy('enrollment.enrolledAt', 'DESC')
            .getRawMany();

        return rows.map((row: any) => ({
            id: row.enrollment_id,
            course: { id: row.course_id, name: row.course_name },
            class: { id: row.class_id, label: row.class_label },
            enrolledAt: row.enrollment_enrolled_at,
            status: row.enrollment_status
        }));
    }

    private async findEnrollmentsForDependent(
        repo: ReturnType<typeof AppDataSource.getRepository<EnrollmentOrm>>,
        schoolId: string,
        dependentId: string
    ): Promise<CourseEnrollmentItem[]> {
        const rows = await repo
            .createQueryBuilder('enrollment')
            .innerJoin('enrollment.courseClass', 'class')
            .innerJoin('class.course', 'course')
            .where('course.schoolId = :schoolId', { schoolId })
            .andWhere('enrollment.dependentId = :dependentId', { dependentId })
            .select([
                'enrollment.id',
                'enrollment.enrolledAt',
                'enrollment.status',
                'course.id',
                'course.name',
                'class.id',
                'class.label'
            ])
            .orderBy('enrollment.enrolledAt', 'DESC')
            .getRawMany();

        return rows.map((row: any) => ({
            id: row.enrollment_id,
            course: { id: row.course_id, name: row.course_name },
            class: { id: row.class_id, label: row.class_label },
            enrolledAt: row.enrollment_enrolled_at,
            status: row.enrollment_status
        }));
    }
}
