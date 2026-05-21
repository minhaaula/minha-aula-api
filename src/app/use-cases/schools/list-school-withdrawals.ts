import { SchoolWithdrawalRepository } from '../../../ports/repositories/school-withdrawal.repo';

export interface ListSchoolWithdrawalsInput {
    schoolId: string;
    month?: number;
    year?: number;
}

export interface SchoolWithdrawalRecord {
    id: string;
    amountCents: number;
    bankName: string;
    bankAgency: string;
    bankAccount: string;
    pixKey: string | null;
    status: 'PROCESSING' | 'COMPLETED' | 'CANCELLED';
    createdAt: Date;
    processedAt: Date | null;
    cancelledAt: Date | null;
}

export interface ListSchoolWithdrawalsOutput {
    withdrawals: SchoolWithdrawalRecord[];
}

export class ListSchoolWithdrawals {
    constructor(
        private readonly withdrawals: SchoolWithdrawalRepository
    ) {}

    async exec(input: ListSchoolWithdrawalsInput): Promise<ListSchoolWithdrawalsOutput> {
        const schoolId = input.schoolId?.trim();
        if (!schoolId) {
            throw new Error('School id is required');
        }

        const filters: { month?: number; year?: number } = {};
        if (input.month !== undefined) {
            if (input.month < 1 || input.month > 12) {
                throw new Error('Month must be between 1 and 12');
            }
            filters.month = input.month;
        }
        if (input.year !== undefined) {
            if (input.year < 2000 || input.year > 3000) {
                throw new Error('Year must be a valid year');
            }
            filters.year = input.year;
        }

        const withdrawals = await this.withdrawals.findBySchoolId(schoolId, filters);

        const records: SchoolWithdrawalRecord[] = withdrawals.map((withdrawal) => ({
            id: withdrawal.id,
            amountCents: withdrawal.amountCents,
            bankName: withdrawal.bankName,
            bankAgency: withdrawal.bankAgency,
            bankAccount: withdrawal.bankAccount,
            pixKey: withdrawal.pixKey,
            status: withdrawal.status,
            createdAt: withdrawal.createdAt,
            processedAt: withdrawal.processedAt,
            cancelledAt: withdrawal.cancelledAt
        }));

        return { withdrawals: records };
    }
}

