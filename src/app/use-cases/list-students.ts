import { UserRepository } from '../../ports/repositories/user.repo';
import { DependentRepository } from '../../ports/repositories/dependent.repo';
import { UserPersonaEnum } from '../../domain/value-objects/user-persona';
import { Dependent } from '../../domain/entities/dependent';
import { buildStudentSummary, type StudentSummary } from './student-summary';
import { CourseClassRepository } from '../../ports/repositories/course-class.repo';
import { EnrollmentRepository } from '../../ports/repositories/enrollment.repo';

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

        return students
            .slice()
            .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
            .filter((student) => !schoolId || schoolLookup.has(student.id))
            .filter((student) => !courseStudentIds || courseStudentIds.has(student.id))
            .map((student) => buildStudentSummary(student, dependentsByUser.get(student.id) ?? []))
            .filter((student) => !nameFilter || student.fullName.toLowerCase().includes(nameFilter));
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
}
