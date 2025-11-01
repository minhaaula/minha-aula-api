import { Dependent } from '../../domain/entities/dependent';

export interface DependentRepository {
    findById(id: string): Promise<Dependent | null>;
    findByCpf(cpf: string): Promise<Dependent | null>;
    findByUserAndFullName(userId: string, fullName: string): Promise<Dependent | null>;
    findByUserIds(userIds: string[]): Promise<Dependent[]>;
    save(dependent: Dependent): Promise<void>;
}
