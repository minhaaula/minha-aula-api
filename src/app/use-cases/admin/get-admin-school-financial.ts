import {
    type AdminSchoolAsaasAccountView,
    presentAdminSchoolAsaasAccountFromSchool
} from '../../presenters/admin-school-asaas-account.presenter';
import type { SchoolRepository } from '../../../ports/repositories/school.repo';
import type { SchoolFinancialChargeRepository } from '../../../ports/repositories/school-financial-charge.repo';
import type { SchoolWithdrawalRepository } from '../../../ports/repositories/school-withdrawal.repo';
import { AppError, ErrorCode } from '../../../shared/errors';
import type { GetSchoolBalance } from '../schools/get-school-balance';

export type GetAdminSchoolFinancialInput = {
    schoolId: string;
};

export type AdminSchoolFinancialBalance = {
    saldoDisponivelCents: number;
    totalGanhoCents: number;
    pendenteCents: number;
    atrasadoCents: number;
};

export type AdminSchoolWithdrawalItem = {
    id: string;
    amountCents: number;
    status: 'PROCESSING' | 'COMPLETED' | 'CANCELLED';
    createdAt: Date;
    processedAt: Date | null;
    observacao: string | null;
};

export type GetAdminSchoolFinancialOutput = {
    schoolId: string;
    balance: AdminSchoolFinancialBalance;
    withdrawals: AdminSchoolWithdrawalItem[];
    /** Status/resumo da subconta Asaas (somente dados persistidos). */
    asaasAccount: AdminSchoolAsaasAccountView | null;
};

export class GetAdminSchoolFinancial {
    constructor(
        private readonly schools: SchoolRepository,
        private readonly financialCharges: SchoolFinancialChargeRepository,
        private readonly withdrawals: SchoolWithdrawalRepository,
        /** Quando definido, `saldoDisponivelCents` vem do Asaas (subconta / `accountId`), não do ledger local. */
        private readonly getSchoolBalance?: GetSchoolBalance
    ) {}

    async exec(input: GetAdminSchoolFinancialInput): Promise<GetAdminSchoolFinancialOutput> {
        const schoolId = input.schoolId?.trim();
        if (!schoolId) {
            throw AppError.fromCode(ErrorCode.REQUIRED_FIELD, { field: 'schoolId' });
        }

        const school = await this.schools.findById(schoolId);
        if (!school) {
            throw AppError.fromCode(ErrorCode.SCHOOL_NOT_FOUND, { schoolId });
        }

        let totalGanhoCents = 0;
        if (this.financialCharges.findPaidChargesBySchoolId) {
            const paidCharges = await this.financialCharges.findPaidChargesBySchoolId(schoolId);
            totalGanhoCents = paidCharges.reduce((sum, c) => sum + c.netAmountCents, 0);
        }

        let pendenteCents = 0;
        if (this.financialCharges.getPendingSummary) {
            const pending = await this.financialCharges.getPendingSummary(schoolId);
            pendenteCents = pending.totalAmountCents;
        }

        let atrasadoCents = 0;
        if (this.financialCharges.getOverdueSummary) {
            const overdue = await this.financialCharges.getOverdueSummary(schoolId);
            atrasadoCents = overdue.totalAmountCents;
        }

        let saldoDisponivelCents = totalGanhoCents;
        if (this.getSchoolBalance) {
            const asaasSaldo = await this.getSchoolBalance.exec({ schoolId });
            saldoDisponivelCents = asaasSaldo.availableBalanceCents;
        }

        const balance: AdminSchoolFinancialBalance = {
            saldoDisponivelCents,
            totalGanhoCents,
            pendenteCents,
            atrasadoCents
        };

        const withdrawalList = await this.withdrawals.findBySchoolId(schoolId);
        const withdrawals: AdminSchoolWithdrawalItem[] = withdrawalList.map((w) => ({
            id: w.id,
            amountCents: w.amountCents,
            status: w.status,
            createdAt: w.createdAt,
            processedAt: w.processedAt,
            observacao: null
        }));

        return {
            schoolId,
            balance,
            withdrawals,
            asaasAccount: presentAdminSchoolAsaasAccountFromSchool(school)
        };
    }
}
