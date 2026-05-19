import { User } from '../../domain/entities/user';
import type { AdminStudentListFilters, AdminStudentListResult } from './enrollment.repo';

export interface UserRepository {
    findByEmail(email: string): Promise<User | null>;
    findByCpf(cpf: string): Promise<User | null>;
    findById(id: string): Promise<User | null>;
    findByPersona(persona: string): Promise<User[]>;
    findBySchoolId?(schoolId: string): Promise<User[]>;
    save(user: User): Promise<void>;
    updatePassword?(userId: string, hashedPassword: string): Promise<void>;
    /** Desativa a conta do usuário (exclusão lógica). Apenas para persona STUDENT. */
    deactivateAccount?(userId: string, motivo: string, descricao: string): Promise<void>;
    /** Soft delete administrativo: libera e-mail/CPF para novo cadastro. */
    softDeleteByAdmin?(userId: string, description?: string | null): Promise<void>;
    /** Indica se o usuário foi excluído logicamente pelo admin. */
    isDeletedByAdmin?(userId: string): Promise<boolean>;
    countByPersona?(persona: string): Promise<number>;
    /** Lista todos os usuários com persona STUDENT (inclui os sem matrícula). */
    findStudentsPaginatedForAdmin?(
        filters: AdminStudentListFilters,
        limit: number,
        offset: number
    ): Promise<AdminStudentListResult>;
}
