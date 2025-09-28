import { School } from '../../domain/entities/school';

export interface SchoolRepository {
    findById(id: string): Promise<School | null>;
    save(school: School): Promise<void>;
}
