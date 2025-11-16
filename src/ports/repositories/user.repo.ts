import { User } from '../../domain/entities/user';

export interface UserRepository {
    findByEmail(email: string): Promise<User | null>;
    findByCpf(cpf: string): Promise<User | null>;
    findById(id: string): Promise<User | null>;
    findByPersona(persona: string): Promise<User[]>;
    findBySchoolId?(schoolId: string): Promise<User[]>;
    save(user: User): Promise<void>;
    updatePassword?(userId: string, hashedPassword: string): Promise<void>;
    countByPersona?(persona: string): Promise<number>;
}
