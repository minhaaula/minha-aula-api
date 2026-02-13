import type { EnrollmentRepository } from '../../ports/repositories/enrollment.repo';
import type { UserRepository } from '../../ports/repositories/user.repo';
import type { AdminStudentListFilters, AdminStudentListResult } from '../../ports/repositories/enrollment.repo';

export type ListAllStudentsInput = {
    name?: string | null;
    schoolId?: string | null;
    cpf?: string | null;
    limit?: number;
    offset?: number;
};

export class ListAllStudents {
    constructor(
        private readonly enrollments: EnrollmentRepository,
        private readonly users?: UserRepository
    ) {}

    async exec(input: ListAllStudentsInput): Promise<AdminStudentListResult> {
        const limit = Math.min(Math.max(input.limit ?? 50, 1), 100);
        const offset = Math.max(0, input.offset ?? 0);
        const filters: AdminStudentListFilters = {
            name: input.name ?? null,
            schoolId: input.schoolId ?? null,
            cpf: input.cpf ?? null
        };

        // Prioridade: listar por usuários (inclui alunos sem matrícula, ex.: criados pelo script)
        const findFromUsers = this.users?.findStudentsPaginatedForAdmin;
        if (findFromUsers) {
            return findFromUsers.call(this.users, filters, limit, offset);
        }

        if (!this.enrollments.findAllPaginatedForAdmin) {
            return { items: [], total: 0, limit, offset };
        }

        return this.enrollments.findAllPaginatedForAdmin(filters, limit, offset);
    }
}
