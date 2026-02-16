import { UserRepository } from '../../ports/repositories/user.repo';
import { DependentRepository } from '../../ports/repositories/dependent.repo';
import { AppDataSource } from '../../infra/db/typeorm/datasource';
import { EnrollmentOrm } from '../../infra/db/typeorm/entities/enrollment.orm';
import { AppError, ErrorCode } from '../../shared/errors';

export interface ListAdminStudentCoursesInput {
    studentId: string;
}

export type CourseEnrollmentItem = {
    id: string;
    school: { id: string; name: string };
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
        const studentId = input.studentId.trim();
        if (!studentId) {
            throw AppError.fromCode(ErrorCode.INVALID_IDENTIFIERS, {
                message: 'studentId é obrigatório'
            });
        }

        const enrollmentRepo = AppDataSource.getRepository(EnrollmentOrm);

        // Aluno é usuário (titular)?
        const user = await this.users.findById(studentId);
        if (user) {
            const courses = await this.findEnrollmentsForUser(enrollmentRepo, studentId);
            const dependentsList = await this.dependents.findByUserIds([studentId]);
            const dependents: DependentCoursesItem[] = [];

            for (const dep of dependentsList) {
                const depCourses = await this.findEnrollmentsForDependent(enrollmentRepo, dep.id);
                dependents.push({
                    dependentId: dep.id,
                    dependentName: dep.fullName,
                    courses: depCourses
                });
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

        const courses = await this.findEnrollmentsForDependent(enrollmentRepo, dependent.id);

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

    private async findEnrollmentsForUser(
        repo: ReturnType<typeof AppDataSource.getRepository<EnrollmentOrm>>,
        userId: string
    ): Promise<CourseEnrollmentItem[]> {
        const rows = await repo
            .createQueryBuilder('enrollment')
            .innerJoin('enrollment.courseClass', 'class')
            .innerJoin('class.course', 'course')
            .innerJoin('course.school', 'school')
            .where('enrollment.studentUserId = :userId', { userId })
            .select([
                'enrollment.id',
                'enrollment.enrolledAt',
                'enrollment.status',
                'course.id',
                'course.name',
                'class.id',
                'class.label',
                'school.id',
                'school.name'
            ])
            .orderBy('enrollment.enrolledAt', 'DESC')
            .getRawMany();

        return rows.map((row: any) => ({
            id: row.enrollment_id,
            school: { id: row.school_id, name: row.school_name },
            course: { id: row.course_id, name: row.course_name },
            class: { id: row.class_id, label: row.class_label },
            enrolledAt: row.enrollment_enrolled_at,
            status: row.enrollment_status
        }));
    }

    private async findEnrollmentsForDependent(
        repo: ReturnType<typeof AppDataSource.getRepository<EnrollmentOrm>>,
        dependentId: string
    ): Promise<CourseEnrollmentItem[]> {
        const rows = await repo
            .createQueryBuilder('enrollment')
            .innerJoin('enrollment.courseClass', 'class')
            .innerJoin('class.course', 'course')
            .innerJoin('course.school', 'school')
            .where('enrollment.dependentId = :dependentId', { dependentId })
            .select([
                'enrollment.id',
                'enrollment.enrolledAt',
                'enrollment.status',
                'course.id',
                'course.name',
                'class.id',
                'class.label',
                'school.id',
                'school.name'
            ])
            .orderBy('enrollment.enrolledAt', 'DESC')
            .getRawMany();

        return rows.map((row: any) => ({
            id: row.enrollment_id,
            school: { id: row.school_id, name: row.school_name },
            course: { id: row.course_id, name: row.course_name },
            class: { id: row.class_id, label: row.class_label },
            enrolledAt: row.enrollment_enrolled_at,
            status: row.enrollment_status
        }));
    }
}
