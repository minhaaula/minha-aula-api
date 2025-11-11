import { SchoolBankAccountRepository } from '../../ports/repositories/school-bank-account.repo';
import { SchoolBankAccount } from '../../domain/entities/school-bank-account';
import { SchoolRepository } from '../../ports/repositories/school.repo';
import { Uuid } from '../../shared/uuid';

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

export class CreateSchoolBankAccount {
    constructor(
        private readonly schools: SchoolRepository,
        private readonly bankAccounts: SchoolBankAccountRepository
    ) {}

    async exec(input: {
        schoolId: string;
        bankName: string;
        bankAgency: string;
        bankAccount: string;
        bankAccountType: 'CORRENTE' | 'POUPANCA';
        bankAccountHolderDocument: string;
    }): Promise<BankAccountView> {
        const schoolId = input.schoolId.trim();
        if (!schoolId) {
            throw new Error('School id is required');
        }

        const school = await this.schools.findById(schoolId);
        if (!school) {
            throw new Error('School not found');
        }

        const account = SchoolBankAccount.create({
            id: Uuid(),
            schoolId,
            bankName: input.bankName,
            bankAgency: input.bankAgency,
            bankAccount: input.bankAccount,
            bankAccountType: input.bankAccountType,
            bankAccountHolderDocument: input.bankAccountHolderDocument
        });

        await this.bankAccounts.save(account);

        return {
            id: account.id,
            schoolId: account.schoolId,
            bankName: account.bankName,
            bankAgency: account.bankAgency,
            bankAccount: account.bankAccount,
            bankAccountType: account.bankAccountType,
            bankAccountHolderDocument: account.bankAccountHolderDocument,
            isActive: account.isActive,
            createdAt: account.createdAt,
            updatedAt: account.updatedAt
        };
    }
}

