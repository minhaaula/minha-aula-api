import { SchoolBankAccountRepository } from '../../ports/repositories/school-bank-account.repo';

export class DeleteSchoolBankAccount {
    constructor(private readonly bankAccounts: SchoolBankAccountRepository) {}

    async exec(input: { accountId: string; schoolId: string }): Promise<void> {
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

        await this.bankAccounts.delete(accountId);
    }
}

