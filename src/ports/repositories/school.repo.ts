import { School } from '../../domain/entities/school';

export interface SchoolRepository {
    findById(id: string): Promise<School | null>;
    findByEmail?(email: string): Promise<School | null>;
    findByOwnerUserId?(userId: string): Promise<School | null>;
    findByOwnerEmail?(email: string): Promise<School | null>;
    findAll(): Promise<School[]>;
    save(school: School): Promise<void>;
}
