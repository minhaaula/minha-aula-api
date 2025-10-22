import { UserRepository } from '../../ports/repositories/user.repo';
import { DependentRepository } from '../../ports/repositories/dependent.repo';
import { UserPersonaEnum } from '../../domain/value-objects/user-persona';
import { Dependent } from '../../domain/entities/dependent';
import {
    buildStudentSummary,
    type StudentSchoolContext,
    type StudentSummary
} from './student-summary';
import { CourseClassRepository } from '../../ports/repositories/course-class.repo';
import { EnrollmentRepository } from '../../ports/repositories/enrollment.repo';
import { CourseRepository } from '../../ports/repositories/course.repo';

type ListStudentsFilters = {
    cpf?: string | null;
    schoolId?: string | null;
    name?: string | null;
    courseId?: string | null;
};

export class ListStudents {
    constructor(
        private readonly users: UserRepository,
        private readonly dependents: DependentRepository,
        private readonly courses: CourseRepository,
        private readonly classes: CourseClassRepository,
        private readonly enrollments: EnrollmentRepository
    ) {}

    async exec(filters?: ListStudentsFilters): Promise<StudentSummary[]> {
        const cpfFilter = filters?.cpf?.trim();
        const schoolId = filters?.schoolId?.trim() || null;
        const nameFilter = filters?.name?.trim().toLowerCase() || null;
        const courseId = filters?.courseId?.trim() || null;

        let courseStudentIds: Set<string> | null = null;
        if (courseId) {
            const classes = await this.classes.findByCourseId(courseId);
            if (classes.length === 0) return [];
            const enrollments = await this.enrollments.findActiveByClassIds(classes.map((cls) => cls.id));
            const studentIds = enrollments
                .map((enrollment) => enrollment.studentUserId)
                .filter((id): id is string => Boolean(id));
            if (studentIds.length === 0) return [];
            courseStudentIds = new Set(studentIds);
        }

        if (cpfFilter) {
            const normalizedCpf = this.normalizeCpf(cpfFilter);
            const student = await this.users.findByCpf(normalizedCpf);
            if (!student || student.persona !== UserPersonaEnum.STUDENT) {
                return [];
            }

            if (schoolId && !(await this.studentBelongsToSchool(student.id, schoolId))) {
                return [];
            }

            if (courseStudentIds && !courseStudentIds.has(student.id)) {
                return [];
            }

            const dependents = await this.dependents.findByUserIds([student.id]);
            const summary = buildStudentSummary(student, dependents);
            if (nameFilter && !summary.fullName.toLowerCase().includes(nameFilter)) {
                return [];
            }
            if (schoolId) {
                return this.enrichWithSchoolContext([summary], schoolId);
            }
            return [summary];
        }

        if (schoolId && !this.users.findBySchoolId) {
            return [];
        }

        const students = await this.users.findByPersona(UserPersonaEnum.STUDENT);
        if (students.length === 0) return [];

        let schoolLookup = new Set<string>();
        if (schoolId) {
            const studentsForSchool = await this.users.findBySchoolId?.(schoolId);
            if (studentsForSchool) {
                schoolLookup = new Set(studentsForSchool.map((student) => student.id));
            }
        }

        const dependents = await this.dependents.findByUserIds(students.map((student) => student.id));
        const dependentsByUser = new Map<string, Dependent[]>();
        for (const dep of dependents) {
            const bucket = dependentsByUser.get(dep.userId) ?? [];
            bucket.push(dep);
            dependentsByUser.set(dep.userId, bucket);
        }

        const summaries = students
            .slice()
            .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
            .filter((student) => !schoolId || schoolLookup.has(student.id))
            .filter((student) => !courseStudentIds || courseStudentIds.has(student.id))
            .map((student) => buildStudentSummary(student, dependentsByUser.get(student.id) ?? []))
            .filter((summary) => !nameFilter || summary.fullName.toLowerCase().includes(nameFilter));

        if (!schoolId || summaries.length === 0) {
            return summaries;
        }

        return this.enrichWithSchoolContext(summaries, schoolId);
    }

    private normalizeCpf(input: string): string {
        const digits = input.replace(/\D/g, '');
        if (digits.length !== 11) {
            throw new Error('Invalid CPF');
        }
        return digits;
    }

    private async studentBelongsToSchool(studentId: string, schoolId: string): Promise<boolean> {
        if (!this.users.findBySchoolId) return false;
        const students = await this.users.findBySchoolId(schoolId);
        return students.some((student) => student.id === studentId);
    }

    private async enrichWithSchoolContext(
        summaries: StudentSummary[],
        schoolId: string
    ): Promise<StudentSummary[]> {
        const contexts = await this.buildSchoolContexts(
            summaries.map((summary) => summary.id),
            schoolId
        );

        return summaries.map((summary) => ({
            ...summary,
            schoolContext: contexts.get(summary.id) ?? {
                schoolId,
                courses: [],
                classes: [],
                categories: []
            }
        }));
    }

    private async buildSchoolContexts(
        studentIds: string[],
        schoolId: string
    ): Promise<Map<string, StudentSchoolContext>> {
        const contextBuilders = new Map<string, {
            courses: Map<string, StudentSchoolContext['courses'][number]>;
            classes: Map<string, StudentSchoolContext['classes'][number]>;
            categories: Map<string, Set<string>>;
        }>();

        for (const studentId of studentIds) {
            contextBuilders.set(studentId, {
                courses: new Map(),
                classes: new Map(),
                categories: new Map()
            });
        }

        if (contextBuilders.size === 0) {
            return new Map();
        }

        const courses = await this.courses.findBySchoolId(schoolId);
        if (courses.length === 0) {
            return this.materializeContexts(contextBuilders, schoolId);
        }

        const courseById = new Map(courses.map((course) => [course.id, course]));
        const courseIds = Array.from(courseById.keys());
        if (courseIds.length === 0) {
            return this.materializeContexts(contextBuilders, schoolId);
        }

        const classes = await this.classes.findByCourseIds(courseIds);
        if (classes.length === 0) {
            return this.materializeContexts(contextBuilders, schoolId);
        }

        const classById = new Map(classes.map((courseClass) => [courseClass.id, courseClass]));
        const classIds = Array.from(classById.keys());
        if (classIds.length === 0) {
            return this.materializeContexts(contextBuilders, schoolId);
        }

        const enrollments = await this.enrollments.findActiveByClassIds(classIds);
        if (enrollments.length === 0) {
            return this.materializeContexts(contextBuilders, schoolId);
        }

        for (const enrollment of enrollments) {
            const builder = contextBuilders.get(enrollment.ownerUserId);
            if (!builder) continue;

            const courseClass = classById.get(enrollment.courseClassId);
            if (!courseClass) continue;

            const course = courseById.get(courseClass.courseId);
            if (!course) continue;

            builder.classes.set(courseClass.id, {
                id: courseClass.id,
                label: courseClass.label,
                courseId: course.id
            });

            builder.courses.set(course.id, {
                id: course.id,
                name: course.name
            });

            for (const category of course.categories ?? []) {
                const existing = builder.categories.get(category.categoryId) ?? new Set<string>();
                for (const subcategoryId of category.subcategoryIds ?? []) {
                    existing.add(subcategoryId);
                }
                builder.categories.set(category.categoryId, existing);
            }
        }

        return this.materializeContexts(contextBuilders, schoolId);
    }

    private materializeContexts(
        builders: Map<string, {
            courses: Map<string, StudentSchoolContext['courses'][number]>;
            classes: Map<string, StudentSchoolContext['classes'][number]>;
            categories: Map<string, Set<string>>;
        }>,
        schoolId: string
    ): Map<string, StudentSchoolContext> {
        const result = new Map<string, StudentSchoolContext>();

        for (const [studentId, builder] of builders.entries()) {
            result.set(studentId, {
                schoolId,
                courses: Array.from(builder.courses.values()),
                classes: Array.from(builder.classes.values()),
                categories: Array.from(builder.categories.entries()).map(([categoryId, subcategoryIds]) => ({
                    categoryId,
                    subcategoryIds: Array.from(subcategoryIds).sort()
                }))
            });
        }

        return result;
    }
}
