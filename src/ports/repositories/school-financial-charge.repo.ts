import { SchoolFinancialCharge, SchoolFinancialChargeStatus } from '../../domain/entities/school-financial-charge';

export type StudentPaymentInfo = {
    chargeId: string;
    courseName: string;
    studentName: string;
    amountCents: number;
    dueDate: Date;
    status: SchoolFinancialChargeStatus;
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
    save(charge: SchoolFinancialCharge): Promise<void>;
    findByDateRange?(startDate: Date, endDate: Date): Promise<SchoolFinancialCharge[]>;
    findByOwnerUserId?(ownerUserId: string, filters?: {
        status?: SchoolFinancialChargeStatus;
        isPaid?: boolean;
    }): Promise<StudentPaymentInfo[]>;
    findPaidChargesBySchoolId?(schoolId: string): Promise<PaidChargeSummary[]>;
}

