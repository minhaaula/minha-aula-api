import { SchoolBankAccountRepository } from '../../ports/repositories/school-bank-account.repo';
import { SchoolBankAccount } from '../../domain/entities/school-bank-account';

type BankAccountView = {
    id: string;
    schoolId: string;
    bankName: string;
    bankAgency: string;
    bankAccount: string;
    bankAccountType: 'CORRENTE' | 'POUPANCA';
    bankAccountHolderDocument: string;
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
        bankAgency?: string;
        bankAccount?: string;
        bankAccountType?: 'CORRENTE' | 'POUPANCA';
        bankAccountHolderDocument?: string;
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
            bankAgency: input.bankAgency,
            bankAccount: input.bankAccount,
            bankAccountType: input.bankAccountType,
            bankAccountHolderDocument: input.bankAccountHolderDocument,
            isActive: input.isActive,
            updatedAt: new Date()
        });

        await this.bankAccounts.save(updated);

        return {
            id: updated.id,
            schoolId: updated.schoolId,
            bankName: updated.bankName,
            bankAgency: updated.bankAgency,
            bankAccount: updated.bankAccount,
            bankAccountType: updated.bankAccountType,
            bankAccountHolderDocument: updated.bankAccountHolderDocument,
            isActive: updated.isActive,
            createdAt: updated.createdAt,
            updatedAt: updated.updatedAt
        };
    }
}

