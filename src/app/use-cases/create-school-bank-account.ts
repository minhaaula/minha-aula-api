import { SchoolBankAccountRepository } from '../../ports/repositories/school-bank-account.repo';
import { SchoolBankAccount } from '../../domain/entities/school-bank-account';
import { SchoolRepository } from '../../ports/repositories/school.repo';
import { Uuid } from '../../shared/uuid';

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

export class CreateSchoolBankAccount {
    constructor(
        private readonly schools: SchoolRepository,
        private readonly bankAccounts: SchoolBankAccountRepository
    ) {}

    async exec(input: {
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
            bankCode: input.bankCode,
            bankAgency: input.bankAgency,
            bankAgencyDigit: input.bankAgencyDigit,
            bankAccount: input.bankAccount,
            bankAccountDigit: input.bankAccountDigit,
            bankAccountType: input.bankAccountType,
            bankAccountHolderDocument: input.bankAccountHolderDocument,
            pixKey: input.pixKey
        });

        await this.bankAccounts.save(account);

        return {
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
        };
    }
}

