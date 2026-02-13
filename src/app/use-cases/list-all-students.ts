import type { EnrollmentRepository } from '../../ports/repositories/enrollment.repo';
import type { AdminStudentListFilters, AdminStudentListResult } from '../../ports/repositories/enrollment.repo';

export type ListAllStudentsInput = {
    name?: string | null;
    schoolId?: string | null;
    cpf?: string | null;
    limit?: number;
    offset?: number;
};

export class ListAllStudents {
    constructor(private readonly enrollments: EnrollmentRepository) {}

    async exec(input: ListAllStudentsInput): Promise<AdminStudentListResult> {
        const findAll = this.enrollments.findAllPaginatedForAdmin;
        if (!findAll) {
            return {
                items: [],
                total: 0,
                limit: Math.min(Math.max(input.limit ?? 50, 1), 100),
                offset: Math.max(0, input.offset ?? 0)
            };
        }

        const limit = Math.min(Math.max(input.limit ?? 50, 1), 100);
        const offset = Math.max(0, input.offset ?? 0);

        return findAll(
            {
                name: input.name ?? null,
                schoolId: input.schoolId ?? null,
                cpf: input.cpf ?? null
            },
            limit,
            offset
        );
    }
}
