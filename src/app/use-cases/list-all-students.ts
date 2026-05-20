import type { EnrollmentRepository } from '../../ports/repositories/enrollment.repo';
import type { UserRepository } from '../../ports/repositories/user.repo';
import type { DependentRepository } from '../../ports/repositories/dependent.repo';
import type { AdminStudentListFilters, AdminStudentListResult, AdminStudentListDependentItem } from '../../ports/repositories/enrollment.repo';

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
            if (this.dependents && result.items.length > 0) {
                const userIds = result.items.map((i) => i.studentId);
                const dependentsList = await this.dependents.findByUserIds(userIds);
                const byOwner = new Map<string, AdminStudentListDependentItem[]>();
                for (const dep of dependentsList) {
                    const item: AdminStudentListDependentItem = {
                        id: dep.id,
                        nome: dep.fullName,
                        cpf: dep.cpf,
                        dataNascimento: dep.birthDate ? dep.birthDate.toISOString().slice(0, 10) : null,
                        vinculo: dep.relationship
                    };
                    const arr = byOwner.get(dep.userId) ?? [];
                    arr.push(item);
                    byOwner.set(dep.userId, arr);
                }
                result.items = result.items.map((student) => ({
                    ...student,
                    dependentes: byOwner.get(student.studentId) ?? []
                }));
            }
            return result;
        }

        if (!this.enrollments.findAllPaginatedForAdmin) {
            return { items: [], total: 0, limit, offset };
        }

        const result = await this.enrollments.findAllPaginatedForAdmin(filters, limit, offset);
        if (this.dependents && result.items.length > 0) {
            const userIds = result.items.map((i) => i.studentId);
            const dependentsList = await this.dependents.findByUserIds(userIds);
            const byOwner = new Map<string, AdminStudentListDependentItem[]>();
            for (const dep of dependentsList) {
                const item: AdminStudentListDependentItem = {
                    id: dep.id,
                    nome: dep.fullName,
                    cpf: dep.cpf,
                    dataNascimento: dep.birthDate ? dep.birthDate.toISOString().slice(0, 10) : null,
                    vinculo: dep.relationship
                };
                const arr = byOwner.get(dep.userId) ?? [];
                arr.push(item);
                byOwner.set(dep.userId, arr);
            }
            result.items = result.items.map((student) => ({
                ...student,
                dependentes: byOwner.get(student.studentId) ?? []
            }));
        }
        return result;
    }
}
