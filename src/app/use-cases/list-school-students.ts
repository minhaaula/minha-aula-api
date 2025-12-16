import { buildStudentSummary, type DependentSummary, type StudentSummary } from './student-summary';
import { CourseRepository } from '../../ports/repositories/course.repo';
import { CourseClassRepository } from '../../ports/repositories/course-class.repo';
import { EnrollmentRepository } from '../../ports/repositories/enrollment.repo';
import { UserRepository } from '../../ports/repositories/user.repo';
import { DependentRepository } from '../../ports/repositories/dependent.repo';
import type { Course } from '../../domain/entities/course';
import type { CourseClass } from '../../domain/entities/course-class';
import type { Enrollment } from '../../domain/entities/enrollment';
import type { User } from '../../domain/entities/user';
import type { Dependent } from '../../domain/entities/dependent';
import { equalUuid } from '../../shared/normalize-uuid';

type ListSchoolStudentsInput = {
    schoolId: string;
    name?: string | null;
    courseId?: string | null;
    classId?: string | null;
    limit?: number;
    offset?: number;
};

export type ListSchoolStudentsOutput = {
    students: SchoolStudentRecord[];
    total: number;
    limit: number;
    offset: number;
};

export type SchoolStudentRecord = {
    enrollmentId: string;
    status: Enrollment['status'];
    studentType: Enrollment['studentType'];
    enrolledAt: Date;
    updatedAt: Date;
    student: StudentSummary;
    dependent: DependentSummary | null;
    course: {
        id: string;
        name: string;
    };
    class: {
        id: string;
        label: string;
    };
};

export class ListSchoolStudents {
    constructor(
        private readonly courses: CourseRepository,
        private readonly classes: CourseClassRepository,
        private readonly enrollments: EnrollmentRepository,
        private readonly users: UserRepository,
        private readonly dependents: DependentRepository
    ) {}

    async exec(input: ListSchoolStudentsInput): Promise<ListSchoolStudentsOutput> {
        const schoolId = input.schoolId?.trim();
        const courseIdFilter = input.courseId?.trim() || null;
        const classIdFilter = input.classId?.trim() || null;
        const nameFilter = input.name?.trim().toLowerCase() || null;
        const limit = Math.min(Math.max(input.limit ?? 50, 1), 100);
        const offset = Math.max(0, input.offset ?? 0);

        if (!schoolId) {
            return {
                students: [],
                total: 0,
                limit,
                offset
            };
        }

        const courses = await this.resolveCourses(schoolId, courseIdFilter, classIdFilter);
        if (!courses || courses.length === 0) {
            return {
                students: [],
                total: 0,
                limit,
                offset
            };
        }

        const classes = await this.resolveClasses(courses, classIdFilter);
        if (!classes || classes.length === 0) {
            return {
                students: [],
                total: 0,
                limit,
                offset
            };
        }

        const enrollments = await this.enrollments.findActiveByClassIds(classes.map((cls) => cls.id));
        if (enrollments.length === 0) {
            return {
                students: [],
                total: 0,
                limit,
                offset
            };
        }

        const owners = await this.loadOwners(enrollments);
        if (owners.size === 0) {
            return {
                students: [],
                total: 0,
                limit,
                offset
            };
        }

        const dependentsByOwner = await this.loadDependents(Array.from(owners.keys()));
        const dependentById = new Map<string, Dependent>();
        for (const list of dependentsByOwner.values()) {
            for (const dep of list) {
                dependentById.set(dep.id, dep);
            }
        }

        const summaries = this.buildSummaries(owners, dependentsByOwner);
        const courseById = new Map(courses.map((course) => [course.id, course]));
        const classById = new Map(classes.map((cls) => [cls.id, cls]));

        const results: SchoolStudentRecord[] = [];

        for (const enrollment of enrollments) {
            const courseClass = classById.get(enrollment.courseClassId);
            if (!courseClass) continue;
            const course = courseById.get(courseClass.courseId);
            if (!course) continue;

            const studentSummary = summaries.get(enrollment.ownerUserId);
            if (!studentSummary) continue;

            let dependentSummary: DependentSummary | null = null;
            if (enrollment.studentType === 'DEPENDENT' && enrollment.dependentId) {
                const dep = dependentById.get(enrollment.dependentId);
                if (!dep) continue;
                dependentSummary = {
                    id: dep.id,
                    userId: dep.userId,
                    fullName: dep.fullName,
                    cpf: dep.cpf,
                    birthDate: dep.birthDate,
                    relationship: dep.relationship,
                    createdAt: dep.createdAt
                };
            }

            if (nameFilter) {
                const ownerMatches = studentSummary.fullName.toLowerCase().includes(nameFilter);
                const dependentMatches = dependentSummary
                    ? dependentSummary.fullName.toLowerCase().includes(nameFilter)
                    : false;
                if (!ownerMatches && !dependentMatches) {
                    continue;
                }
            }

            results.push({
                enrollmentId: enrollment.id,
                status: enrollment.status,
                studentType: enrollment.studentType,
                enrolledAt: enrollment.enrolledAt,
                updatedAt: enrollment.updatedAt,
                student: studentSummary,
                dependent: dependentSummary,
                course: { id: course.id, name: course.name },
                class: { id: courseClass.id, label: courseClass.label }
            });
        }

        const sortedResults = results.sort((a, b) => b.enrolledAt.getTime() - a.enrolledAt.getTime());
        const total = sortedResults.length;
        const paginatedResults = sortedResults.slice(offset, offset + limit);

        return {
            students: paginatedResults,
            total,
            limit,
            offset
        };
    }

    private async resolveCourses(
        schoolId: string,
        courseIdFilter: string | null,
        classIdFilter: string | null
    ): Promise<Course[] | null> {
        if (classIdFilter) {
            const courseClass = await this.classes.findById(classIdFilter);
            if (!courseClass || !courseClass.isActive) return null;
            const course = await this.courses.findById(courseClass.courseId);
            if (!course || !course.isActive || !equalUuid(course.schoolId, schoolId)) return null;
            if (courseIdFilter && !equalUuid(course.id, courseIdFilter)) return null;
            return [course];
        }

        if (courseIdFilter) {
            const course = await this.courses.findById(courseIdFilter);
            if (!course || !course.isActive || !equalUuid(course.schoolId, schoolId)) return null;
            return [course];
        }

        const courses = await this.courses.findBySchoolId(schoolId);
        return courses.filter((course) => course.isActive);
    }

    private async resolveClasses(courses: Course[], classIdFilter: string | null): Promise<CourseClass[] | null> {
        if (!courses.length) return null;
        const courseIds = courses.map((course) => course.id);

        if (classIdFilter) {
            const courseClass = await this.classes.findById(classIdFilter);
            if (!courseClass || !courseClass.isActive) return null;
            if (!courseIds.some((id) => equalUuid(id, courseClass.courseId))) return null;
            return [courseClass];
        }

        const classes = await this.classes.findByCourseIds(courseIds);
        return classes.filter((cls) => cls.isActive);
    }

    private async loadOwners(enrollments: Enrollment[]): Promise<Map<string, User>> {
        const uniqueOwnerIds = Array.from(new Set(enrollments.map((enrollment) => enrollment.ownerUserId)));
        const owners = new Map<string, User>();

        await Promise.all(uniqueOwnerIds.map(async (ownerId) => {
            const user = await this.users.findById(ownerId);
            if (user) {
                owners.set(ownerId, user);
            }
        }));

        return owners;
    }

    private async loadDependents(ownerIds: string[]): Promise<Map<string, Dependent[]>> {
        if (!ownerIds.length) return new Map();
        const rows = await this.dependents.findByUserIds(ownerIds);
        const dependents = new Map<string, Dependent[]>();

        for (const dep of rows) {
            const list = dependents.get(dep.userId) ?? [];
            list.push(dep);
            dependents.set(dep.userId, list);
        }

        return dependents;
    }

    private buildSummaries(
        owners: Map<string, User>,
        dependents: Map<string, Dependent[]>
    ): Map<string, StudentSummary> {
        const summaries = new Map<string, StudentSummary>();
        for (const [ownerId, owner] of owners.entries()) {
            const deps = dependents.get(ownerId) ?? [];
            summaries.set(ownerId, buildStudentSummary(owner, deps));
        }
        return summaries;
    }
}
