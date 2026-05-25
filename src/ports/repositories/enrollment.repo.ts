import { Enrollment } from '../../domain/entities/enrollment';
import type { TuitionExemptionType } from '../../domain/value-objects/tuition-exemption-type';

export type EnrollmentWithDetails = {
    studentId: string;
    studentName: string | null;
    studentCpf: string | null;
    createdAt: Date;
    courseName: string | null;
    className: string | null;
    schoolName: string | null;
};

export type MyCourseEnrollmentStatus = 'PENDING' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED';

export type MyCourseData = {
    courseId: string;
    courseName: string;
    schoolId: string;
    schoolName: string;
    studentName: string;
    schedule: Array<{ day: string; start: string; end: string }>;
    /** Indica se o curso está ativo na escola (`courses.is_active`). */
    active: boolean;
    /** Status da matrícula do aluno/dependente na turma. */
    enrollmentStatus: MyCourseEnrollmentStatus;
};

export type MyTuitionExemptEnrollmentData = {
    enrollmentId: string;
    studentName: string;
    courseId: string;
    courseName: string;
    classId: string;
    className: string;
    tuitionExemptionType: TuitionExemptionType;
    /** Valor de referência da mensalidade (turma ou curso), em centavos. */
    monthlyTuitionAmountCents: number | null;
};

export type AdminStudentListFilters = {
    schoolId?: string | null;
    name?: string | null;
    cpf?: string | null;
    /** Cidade do endereço do titular (contém, case insensitive). */
    city?: string | null;
};

/** Item de dependente na listagem admin (dentro do titular). */
export type AdminStudentListDependentItem = {
    id: string;
    nome: string;
    cpf: string | null;
    dataNascimento: string | null;
    vinculo: string | null;
    /** Matrículas ativas do dependente. */
    countCursos: number;
};

export type AdminStudentListItem = {
    cpf: string | null;
    studentId: string;
    studentName: string;
    /** Conta do titular: ACTIVE (ativo) ou INACTIVE (inativo). */
    status: 'ACTIVE' | 'INACTIVE';
    studentType: 'USER';
    /** Data de nascimento do titular (YYYY-MM-DD). */
    birthDate: string | null;
    endereco: {
        street: string;
        number: string;
        complement: string | null;
        district: string | null;
        city: string;
        state: string;
        zipCode: string;
    };
    createdAt: string;
    countCursos: number;
    dependentes: AdminStudentListDependentItem[];
};

export type AdminStudentListResult = {
    items: AdminStudentListItem[];
    total: number;
    limit: number;
    offset: number;
};

export interface EnrollmentRepository {
    findById(id: string): Promise<Enrollment | null>;
    /** Matrícula ativa ou pendente na turma (bloqueia nova solicitação/matriculação). */
    findByClassAndUser(classId: string, userId: string): Promise<Enrollment | null>;
    findByClassAndDependent(classId: string, dependentId: string): Promise<Enrollment | null>;
    findActiveByClassIds(classIds: string[]): Promise<Enrollment[]>;
    findActiveByDependentId(dependentId: string): Promise<Enrollment[]>;
    /** Contagem de matrículas ACTIVE por dependente (chave = dependentId). */
    countActiveEnrollmentsByDependentIds?(dependentIds: string[]): Promise<Map<string, number>>;
    save(enrollment: Enrollment): Promise<void>;
    findRecent?(limit: number): Promise<EnrollmentWithDetails[]>;
    findRecentBySchoolId?(schoolId: string, limit: number): Promise<EnrollmentWithDetails[]>;
    countActiveBySchoolId?(schoolId: string): Promise<number>;
    findMyCourses?(userId: string): Promise<MyCourseData[]>;
    /** Matrículas ativas isentas de mensalidade do titular e dependentes. */
    findMyTuitionExemptEnrollments?(userId: string): Promise<MyTuitionExemptEnrollmentData[]>;
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
