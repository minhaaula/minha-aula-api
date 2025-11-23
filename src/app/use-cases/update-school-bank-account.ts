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

export class UpdateSchoolBankAccount {
    constructor(private readonly bankAccounts: SchoolBankAccountRepository) {}

    async exec(input: {
        accountId: string;
        schoolId: string;
        bankName?: string;
        bankCode?: number;
        bankAgency?: string;
        bankAgencyDigit?: string;
        bankAccount?: string;
        bankAccountDigit?: string;
        bankAccountType?: 'CORRENTE' | 'POUPANCA';
        bankAccountHolderDocument?: string;
        pixKey?: string;
        isActive?: boolean;
    }): Promise<BankAccountView> {
        const accountId = input.accountId.trim();
        if (!accountId) {
            throw new Error('Account id is required');
        }

        const schoolId = input.schoolId.trim();
        if (!schoolId) {
            throw new Error('School id is required');
        }

        const existing = await this.bankAccounts.findById(accountId);
        if (!existing) {
            throw new Error('Bank account not found');
        }

        if (existing.schoolId !== schoolId) {
            throw new Error('Bank account does not belong to this school');
        }

        const updated = existing.withChanges({
            bankName: input.bankName,
            bankCode: input.bankCode,
            bankAgency: input.bankAgency,
            bankAgencyDigit: input.bankAgencyDigit,
            bankAccount: input.bankAccount,
            bankAccountDigit: input.bankAccountDigit,
            bankAccountType: input.bankAccountType,
            bankAccountHolderDocument: input.bankAccountHolderDocument,
            pixKey: input.pixKey,
            isActive: input.isActive,
            updatedAt: new Date()
        });

        await this.bankAccounts.save(updated);

        return {
            id: updated.id,
            schoolId: updated.schoolId,
            bankName: updated.bankName,
            bankCode: updated.bankCode,
            bankAgency: updated.bankAgency,
            bankAgencyDigit: updated.bankAgencyDigit,
            bankAccount: updated.bankAccount,
            bankAccountDigit: updated.bankAccountDigit,
            bankAccountType: updated.bankAccountType,
            bankAccountHolderDocument: updated.bankAccountHolderDocument,
            pixKey: updated.pixKey,
            isActive: updated.isActive,
            createdAt: updated.createdAt,
            updatedAt: updated.updatedAt
        };
    }
}

