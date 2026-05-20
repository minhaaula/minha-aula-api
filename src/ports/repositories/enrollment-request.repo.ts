import { EnrollmentRequest, EnrollmentRequestStatus } from '../../domain/entities/enrollment-request';

export type ScheduleEntry = { day: string; start: string; end: string };

export type EnrollmentRequestSchoolAddress = {
    street: string;
    number: string;
    complement?: string | null;
    district?: string | null;
    city: string;
    state: string;
    zipCode: string;
};

export interface EnrollmentRequestWithDetails {
    request: EnrollmentRequest;
    courseClassLabel: string | null;
    courseLabel: string | null;
    studentName: string;
    dependentName: string | null;
    /** Nome da escola (preenchido quando o repositório carrega a relação school). */
    schoolName?: string | null;
    /** Valor da mensalidade em centavos (da turma). */
    monthlyPriceCents?: number | null;
    /** Horários da turma (dia, início, fim). */
    schedule?: ScheduleEntry[] | null;
    /** Endereço principal da escola (quando carregado). */
    schoolAddress?: EnrollmentRequestSchoolAddress | null;
    /** WhatsApp de contato da escola (`owner_whatsapp`). */
    schoolWhatsapp?: string | null;
    /** Data de nascimento do aluno (usuário ou dependente). */
    studentBirthDate?: Date | null;
    /** Parentesco do dependente (quando o pedido é para dependente). */
    dependentRelationship?: string | null;
}

export type AdminEnrollmentRequestItem = EnrollmentRequestWithDetails & { schoolName: string };

export interface EnrollmentRequestRepository {
    findById(id: string): Promise<EnrollmentRequest | null>;
    /** Última solicitação APPROVED (ex.: desconto em mensalidades). */
    findByCourseClassAndTarget(params: { courseClassId: string; userId: string; dependentId: string | null; }): Promise<EnrollmentRequest | null>;
    findLatestApprovedByCourseClassAndTarget(params: { courseClassId: string; userId: string; dependentId: string | null; }): Promise<EnrollmentRequest | null>;
    /** Solicitação PENDING em aberto (bloqueia nova solicitação duplicada). */
    findPendingByCourseClassAndTarget(params: { courseClassId: string; userId: string; dependentId: string | null; }): Promise<EnrollmentRequest | null>;
    findMany(params: {
        schoolId?: string;
        courseClassId?: string;
        courseId?: string;
        status?: EnrollmentRequestStatus;
        /** Filtro por múltiplos status (ex.: PENDING + CANCELLED). Se presente, ignora status. */
        statusIn?: EnrollmentRequestStatus[];
        requestedForUserId?: string;
        requestedForDependentId?: string | null;
        studentDocument?: string;
        limit?: number;
        offset?: number;
    }): Promise<EnrollmentRequestWithDetails[]>;
    /** Lista pedidos de matrícula de todas as escolas (admin). Filtros: nome aluno, cpf aluno, nome escola. */
    findManyForAdmin?(params: {
        studentName?: string | null;
        studentCpf?: string | null;
        schoolName?: string | null;
        status?: EnrollmentRequestStatus | null;
        limit?: number;
        offset?: number;
    }): Promise<{ items: AdminEnrollmentRequestItem[]; total: number }>;
    countPendingBySchoolId?(schoolId: string): Promise<number>;
    save(request: EnrollmentRequest): Promise<void>;
}
