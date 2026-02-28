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

export type MyCourseData = {
    courseId: string;
    courseName: string;
    schoolId: string;
    schoolName: string;
    studentName: string;
    schedule: Array<{ day: string; start: string; end: string }>;
};

export type AdminStudentListFilters = {
    schoolId?: string | null;
    name?: string | null;
    cpf?: string | null;
};

export type AdminStudentListItem = {
    enrollmentId: string | null;
    schoolId: string | null;
    schoolName: string | null;
    studentName: string;
    cpf: string | null;
    courseName: string | null;
    className: string | null;
    enrolledAt: Date | null;
    studentType: 'USER' | 'DEPENDENT';
    studentId: string;
};

export type AdminStudentListResult = {
    items: AdminStudentListItem[];
    total: number;
    limit: number;
    offset: number;
};

export interface EnrollmentRepository {
    findById(id: string): Promise<Enrollment | null>;
    findByClassAndUser(classId: string, userId: string): Promise<Enrollment | null>;
    findByClassAndDependent(classId: string, dependentId: string): Promise<Enrollment | null>;
    findActiveByClassIds(classIds: string[]): Promise<Enrollment[]>;
    findActiveByDependentId(dependentId: string): Promise<Enrollment[]>;
    save(enrollment: Enrollment): Promise<void>;
    findRecent?(limit: number): Promise<EnrollmentWithDetails[]>;
    findRecentBySchoolId?(schoolId: string, limit: number): Promise<EnrollmentWithDetails[]>;
    countActiveBySchoolId?(schoolId: string): Promise<number>;
    findMyCourses?(userId: string): Promise<MyCourseData[]>;
    hasActiveEnrollmentInSchool?(schoolId: string, userId: string): Promise<boolean>;
    findAllPaginatedForAdmin?(
        filters: AdminStudentListFilters,
        limit: number,
        offset: number
    ): Promise<AdminStudentListResult>;
    /** Conta matrículas criadas no mês/ano. */
    countEnrollmentsInMonth?(year: number, month: number): Promise<number>;
    /** Conta alunos únicos com matrícula ativa (usuários + dependentes). */
    countTotalActiveStudents?(): Promise<number>;
    /** Top escolas por quantidade de alunos (matrículas ativas). */
    getTopSchoolsByStudentCount?(limit: number): Promise<Array<{ schoolId: string; schoolName: string; city: string | null; count: number }>>;
}
