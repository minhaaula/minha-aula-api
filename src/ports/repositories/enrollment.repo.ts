import { Enrollment } from '../../domain/entities/enrollment';

export type EnrollmentWithDetails = {
    studentId: string;
    studentName: string | null;
    studentCpf: string | null;
    createdAt: Date;
    courseName: string | null;
    className: string | null;
    schoolName: string | null;
};

export interface EnrollmentRepository {
    findById(id: string): Promise<Enrollment | null>;
    findByClassAndUser(classId: string, userId: string): Promise<Enrollment | null>;
    findByClassAndDependent(classId: string, dependentId: string): Promise<Enrollment | null>;
    findActiveByClassIds(classIds: string[]): Promise<Enrollment[]>;
    save(enrollment: Enrollment): Promise<void>;
    findRecent?(limit: number): Promise<EnrollmentWithDetails[]>;
}
