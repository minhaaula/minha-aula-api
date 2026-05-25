import type { EnrollmentRepository } from '../../../ports/repositories/enrollment.repo';
import type { UserRepository } from '../../../ports/repositories/user.repo';
import type { DependentRepository } from '../../../ports/repositories/dependent.repo';
import type {
    AdminStudentListFilters,
    AdminStudentListResult,
    AdminStudentListItem,
    AdminStudentListDependentItem
} from '../../../ports/repositories/enrollment.repo';
import type { Dependent } from '../../../domain/entities/dependent';

export type ListAllStudentsInput = {
    name?: string | null;
    schoolId?: string | null;
    cpf?: string | null;
    city?: string | null;
    limit?: number;
    offset?: number;
};

export class ListAllStudents {
    constructor(
        private readonly enrollments: EnrollmentRepository,
        private readonly users?: UserRepository,
        private readonly dependents?: DependentRepository
    ) {}

    async exec(input: ListAllStudentsInput): Promise<AdminStudentListResult> {
        const limit = Math.min(Math.max(input.limit ?? 50, 1), 100);
        const offset = Math.max(0, input.offset ?? 0);
        const filters: AdminStudentListFilters = {
            name: input.name ?? null,
            schoolId: input.schoolId ?? null,
            cpf: input.cpf ?? null,
            city: input.city ?? null
        };

        const findFromUsers = this.users?.findStudentsPaginatedForAdmin;
        if (findFromUsers) {
            const result = await findFromUsers.call(this.users, filters, limit, offset);
            result.items = await this.attachDependents(result.items);
            return result;
        }

        if (!this.enrollments.findAllPaginatedForAdmin) {
            return { items: [], total: 0, limit, offset };
        }

        const result = await this.enrollments.findAllPaginatedForAdmin(filters, limit, offset);
        result.items = await this.attachDependents(result.items);
        return result;
    }

    private async attachDependents(items: AdminStudentListItem[]): Promise<AdminStudentListItem[]> {
        if (!this.dependents || items.length === 0) {
            return items;
        }

        const userIds = items.map((i) => i.studentId);
        const dependentsList = await this.dependents.findByUserIds(userIds);
        if (dependentsList.length === 0) {
            return items.map((student) => ({ ...student, dependentes: [] }));
        }

        const courseCountByDependent = await this.resolveDependentCourseCounts(dependentsList);
        const byOwner = new Map<string, AdminStudentListDependentItem[]>();

        for (const dep of dependentsList) {
            const item: AdminStudentListDependentItem = {
                id: dep.id,
                nome: dep.fullName,
                cpf: dep.cpf,
                dataNascimento: dep.birthDate ? dep.birthDate.toISOString().slice(0, 10) : null,
                vinculo: dep.relationship,
                countCursos: courseCountByDependent.get(dep.id) ?? 0
            };
            const arr = byOwner.get(dep.userId) ?? [];
            arr.push(item);
            byOwner.set(dep.userId, arr);
        }

        return items.map((student) => ({
            ...student,
            dependentes: byOwner.get(student.studentId) ?? []
        }));
    }

    private async resolveDependentCourseCounts(dependentsList: Dependent[]): Promise<Map<string, number>> {
        if (!this.enrollments.countActiveEnrollmentsByDependentIds) {
            return new Map();
        }
        return this.enrollments.countActiveEnrollmentsByDependentIds(dependentsList.map((dep) => dep.id));
    }
}
