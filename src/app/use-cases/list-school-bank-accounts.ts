import { SchoolBankAccountRepository } from '../../ports/repositories/school-bank-account.repo';
import { SchoolBankAccount } from '../../domain/entities/school-bank-account';

type BankAccountView = {
    id: string;
    schoolId: string;
    bankName: string;
    bankCode?: number;
    bankAgency: string;
    bankAgencyDigit?: string;
    bankAccount: string;
    bankAccountDigit?: string;
    bankAccountType: 'CORRENTE' | 'POUPANCA';
    bankAccountHolderDocument: string;
    pixKey?: string;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
};

export class ListSchoolBankAccounts {
    constructor(private readonly bankAccounts: SchoolBankAccountRepository) {}

    async exec(input: { schoolId: string; activeOnly?: boolean }): Promise<{ accounts: BankAccountView[] }> {
        const schoolId = input.schoolId.trim();
        if (!schoolId) {
            throw new Error('School id is required');
        }

        const accounts = input.activeOnly
            ? await this.bankAccounts.findBySchoolIdAndActive(schoolId)
            : await this.bankAccounts.findBySchoolId(schoolId);

        return {
            accounts: accounts.map((account) => ({
                id: account.id,
                schoolId: account.schoolId,
                bankName: account.bankName,
                bankCode: account.bankCode,
                bankAgency: account.bankAgency,
                bankAgencyDigit: account.bankAgencyDigit,
                bankAccount: account.bankAccount,
                bankAccountDigit: account.bankAccountDigit,
                bankAccountType: account.bankAccountType,
                bankAccountHolderDocument: account.bankAccountHolderDocument,
                pixKey: account.pixKey,
                isActive: account.isActive,
                createdAt: account.createdAt,
                updatedAt: account.updatedAt
            }))
        };
    }
}

