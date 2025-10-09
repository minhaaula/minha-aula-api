import { ClassSession } from '../../domain/entities/class-session';

export interface ClassSessionRepository {
    findById(id: string): Promise<ClassSession | null>;
    findByClassAndInterval(params: { courseClassId: string; from: Date; to: Date }): Promise<ClassSession[]>;
    findBySchoolAndInterval(params: { schoolId: string; from: Date; to: Date; courseClassId?: string | null }): Promise<ClassSession[]>;
    save(session: ClassSession): Promise<void>;
    delete(id: string): Promise<void>;
}
