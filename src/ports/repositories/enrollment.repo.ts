import { Enrollment } from '../../domain/entities/enrollment';

export interface EnrollmentRepository {
    findById(id: string): Promise<Enrollment | null>;
    findByClassAndUser(classId: string, userId: string): Promise<Enrollment | null>;
    findByClassAndDependent(classId: string, dependentId: string): Promise<Enrollment | null>;
    findActiveByClassIds(classIds: string[]): Promise<Enrollment[]>;
    save(enrollment: Enrollment): Promise<void>;
}
