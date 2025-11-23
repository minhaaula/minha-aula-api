import { SchoolRepository } from '../../ports/repositories/school.repo';
import { type PostalAddressProps } from '../../domain/value-objects/postal-address';
import { SchoolBankAccountRepository } from '../../ports/repositories/school-bank-account.repo';

type BankAccountView = {
    id: string;
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

export class GetSchoolProfile {
    constructor(
        private readonly schools: SchoolRepository,
        private readonly bankAccounts?: SchoolBankAccountRepository
    ) {}

    async exec(input: { schoolId: string }): Promise<{
        id: string;
        name: string;
        email: string;
        phone: string;
        cnpj: string;
        addresses: PostalAddressProps[];
        createdAt: Date;
        ownerUserId: string | null;
        ownerName: string | null;
        ownerCpf: string | null;
        ownerEmail: string | null;
        incomeValue: number;
        bankAccounts: BankAccountView[];
    } | null> {
        const schoolId = input.schoolId.trim();
        if (!schoolId) return null;

        const school = await this.schools.findById(schoolId);
        if (!school) {
            return null;
        }

        const accounts = this.bankAccounts
            ? await this.bankAccounts.findBySchoolId(schoolId)
            : [];

        return {
            id: school.id,
            name: school.name,
            email: school.email,
            phone: school.phone,
            cnpj: school.cnpj,
            addresses: school.addresses.map((address) => address.toPrimitives()),
            createdAt: school.createdAt,
            ownerUserId: school.ownerUserId,
            ownerName: school.ownerName,
            ownerCpf: school.ownerCpf,
            ownerEmail: school.ownerEmail,
            incomeValue: school.incomeValue,
            bankAccounts: accounts.map((account) => ({
                id: account.id,
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
