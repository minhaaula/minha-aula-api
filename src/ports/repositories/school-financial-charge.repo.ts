import { SchoolFinancialCharge, SchoolFinancialChargeStatus, SchoolFinancialChargeType } from '../../domain/entities/school-financial-charge';

export type StudentPaymentInfo = {
    chargeId: string;
    courseName: string;
    studentName: string;
    /** Texto persistido na cobrança (pode ser null em registros antigos). */
    rawDescription: string | null;
    /** Valor original em centavos (antes do desconto). */
    amountCents: number;
    /** Desconto em centavos, ou null se não houver. */
    discountCents: number | null;
    /** Motivo do desconto (ex.: "Desconto aplicado (1 de 3 meses)"). */
    discountReason: string | null;
    /** Valor líquido em centavos (amountCents - discountCents). */
    netAmountCents: number;
    /** Líquido retornado pelo provedor (ex.: Asaas `netValue`), em centavos. */
    providerNetAmountCents: number | null;
    dueDate: Date;
    status: SchoolFinancialChargeStatus;
    chargeType: SchoolFinancialChargeType;
    schoolId: string;
    schoolName: string;
    paidAt: Date | null;
    paidObservation: string | null;
};

/** Item de cobrança para listagem admin (mensalidades do aluno em todas as escolas). */
export type AdminStudentChargeItem = {
    id: string;
    school: { id: string; name: string };
    course: { id: string; name: string };
    class: { id: string; label: string };
    amountCents: number;
    discountCents: number | null;
    discountReason: string | null;
    netAmountCents: number;
    description: string | null;
    chargeType: SchoolFinancialChargeType;
    dueDate: Date;
    status: SchoolFinancialChargeStatus;
    paidAt: Date | null;
};

export type StudentPaidTotalByYear = {
    year: number;
    /** Soma de `netAmountCents` das cobranças pagas no ano (por `paidAt`). */
    totalPaidCents: number;
    paymentCount: number;
};

export type PaidChargeSummary = {
    id: string;
    netAmountCents: number;
    paidAt: Date;
    description: string | null;
    studentName: string;
    courseName: string;
};

export interface SchoolFinancialChargeRepository {
    findById(id: string): Promise<SchoolFinancialCharge | null>;
    /** Cobrança de aluno/matrícula sincronizada com Asaas (`school_financial_charges.asaas_payment_id`). */
    findByAsaasPaymentId(asaasPaymentId: string): Promise<SchoolFinancialCharge | null>;
    save(charge: SchoolFinancialCharge): Promise<void>;
    findByDateRange?(startDate: Date, endDate: Date): Promise<SchoolFinancialCharge[]>;
    findByOwnerUserId?(ownerUserId: string, filters?: {
        status?: SchoolFinancialChargeStatus;
        isPaid?: boolean;
        /** Filtra por ano civil: `paidAt` se isPaid=true, senão `dueDate`. */
        year?: number;
    }): Promise<StudentPaymentInfo[]>;
    /** Totais pagos agrupados por ano civil (`paidAt`), do titular e dependentes. */
    getPaidTotalsByYearForOwnerUserId?(ownerUserId: string): Promise<StudentPaidTotalByYear[]>;
    findPaidChargesBySchoolId?(schoolId: string): Promise<PaidChargeSummary[]>;
    findLastTuitionCharge?(enrollmentId: string, courseClassId: string, ownerUserId: string, studentUserId: string | null, dependentId: string | null): Promise<SchoolFinancialCharge | null>;
    findEarliestTuitionCharge?(courseClassId: string, ownerUserId: string, studentUserId: string | null, dependentId: string | null): Promise<SchoolFinancialCharge | null>;
    findTuitionChargesForMonth?(courseClassId: string, ownerUserId: string, studentUserId: string | null, dependentId: string | null, year: number, month: number): Promise<SchoolFinancialCharge[]>;
    getRevenueHistory?(schoolId: string, monthsLimit: number): Promise<Array<{ month: string; valueCents: number }>>;
    getOverdueSummary?(schoolId: string): Promise<{ totalAmountCents: number; count: number }>;
    getPendingSummary?(schoolId: string): Promise<{ totalAmountCents: number; count: number }>;
    getRevenueForecast?(schoolId: string, month: number, year: number): Promise<number>;
    getBillingConsolidatedByMonth?(
        schoolId: string,
        monthsLimit: number
    ): Promise<Array<{ year: number; month: number; ganhoCents: number; pendenteCents: number; atrasadoCents: number; totalCents: number }>>;
    getCurrentMonthRevenue?(schoolId: string, month: number, year: number): Promise<number>;
    countChargesWithDiscount?(courseClassId: string, ownerUserId: string, studentUserId: string | null, dependentId: string | null): Promise<number>;
    /** Lista todas as cobranças (mensalidades) do aluno em todas as escolas. studentType USER = studentUserId, DEPENDENT = dependentId. */
    findChargesByStudentIdForAdmin?(studentId: string, studentType: 'USER' | 'DEPENDENT'): Promise<AdminStudentChargeItem[]>;
    /** Lista todas as cobranças do usuário em todas as escolas, incluindo cobranças dos dependentes desse usuário. */
    findChargesByOwnerIdIncludingDependentsForAdmin?(ownerUserId: string): Promise<AdminStudentChargeItem[]>;
    /** Receita de mensalidades (charges PAID) por mês para dashboard. */
    getTuitionRevenueByMonthForDashboard?(monthsLimit: number): Promise<Array<{ year: number; month: number; valorCents: number }>>;
    /** Total de cobranças atrasadas (status OVERDUE) em centavos. */
    getOverdueTotalCents?(): Promise<number>;
}

