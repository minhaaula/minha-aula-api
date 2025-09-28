import { Dependent } from '../../domain/entities/dependent';

export interface DependentRepository {
    findById(id: string): Promise<Dependent | null>;
    findByUserAndFullName(userId: string, fullName: string): Promise<Dependent | null>;
    save(dependent: Dependent): Promise<void>;
}
