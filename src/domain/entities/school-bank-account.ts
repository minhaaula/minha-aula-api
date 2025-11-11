export type BankAccountType = 'CORRENTE' | 'POUPANCA';

export class SchoolBankAccount {
    private constructor(
        public readonly id: string,
        public readonly schoolId: string,
        public readonly bankName: string,
        public readonly bankAgency: string,
        public readonly bankAccount: string,
        public readonly bankAccountType: BankAccountType,
        public readonly bankAccountHolderDocument: string,
        public readonly isActive: boolean,
        public readonly createdAt: Date,
        public readonly updatedAt: Date
    ) {}

    static create(params: {
        id: string;
        schoolId: string;
        bankName: string;
        bankAgency: string;
        bankAccount: string;
        bankAccountType: BankAccountType;
        bankAccountHolderDocument: string;
        isActive?: boolean;
        createdAt?: Date;
        updatedAt?: Date;
    }): SchoolBankAccount {
        const id = params.id.trim();
        if (!id) throw new Error('Bank account id is required');

        const schoolId = params.schoolId.trim();
        if (!schoolId) throw new Error('School id is required');

        const bankName = SchoolBankAccount.normalizeBankName(params.bankName);
        const bankAgency = SchoolBankAccount.normalizeBankAgency(params.bankAgency);
        const bankAccount = SchoolBankAccount.normalizeBankAccount(params.bankAccount);
        const bankAccountType = SchoolBankAccount.normalizeBankAccountType(params.bankAccountType);
        const bankAccountHolderDocument = SchoolBankAccount.normalizeBankAccountHolderDocument(params.bankAccountHolderDocument);
        const isActive = params.isActive ?? true;
        const createdAt = params.createdAt ?? new Date();
        const updatedAt = params.updatedAt ?? createdAt;

        return new SchoolBankAccount(
            id,
            schoolId,
            bankName,
            bankAgency,
            bankAccount,
            bankAccountType,
            bankAccountHolderDocument,
            isActive,
            createdAt,
            updatedAt
        );
    }

    private static normalizeBankName(value: string): string {
        const trimmed = value.trim();
        if (!trimmed) {
            throw new Error('Bank name is required');
        }
        if (trimmed.length > 191) {
            throw new Error('Bank name must have at most 191 characters');
        }
        return trimmed;
    }

    private static normalizeBankAgency(value: string): string {
        const digits = value.replace(/\D/g, '');
        if (digits.length === 0) {
            throw new Error('Bank agency is required');
        }
        if (digits.length > 20) {
            throw new Error('Bank agency must have at most 20 characters');
        }
        return digits;
    }

    private static normalizeBankAccount(value: string): string {
        const digits = value.replace(/\D/g, '');
        if (digits.length === 0) {
            throw new Error('Bank account is required');
        }
        if (digits.length > 20) {
            throw new Error('Bank account must have at most 20 characters');
        }
        return digits;
    }

    private static normalizeBankAccountType(value: BankAccountType): BankAccountType {
        if (value !== 'CORRENTE' && value !== 'POUPANCA') {
            throw new Error('Bank account type must be CORRENTE or POUPANCA');
        }
        return value;
    }

    private static normalizeBankAccountHolderDocument(value: string): string {
        const digits = value.replace(/\D/g, '');
        if (digits.length === 0) {
            throw new Error('Bank account holder document is required');
        }
        if (digits.length !== 11 && digits.length !== 14) {
            throw new Error('Bank account holder document must be CPF (11 digits) or CNPJ (14 digits)');
        }
        return digits;
    }

    withChanges(changes: {
        bankName?: string;
        bankAgency?: string;
        bankAccount?: string;
        bankAccountType?: BankAccountType;
        bankAccountHolderDocument?: string;
        isActive?: boolean;
        updatedAt?: Date;
    }): SchoolBankAccount {
        return SchoolBankAccount.create({
            id: this.id,
            schoolId: this.schoolId,
            bankName: changes.bankName ?? this.bankName,
            bankAgency: changes.bankAgency ?? this.bankAgency,
            bankAccount: changes.bankAccount ?? this.bankAccount,
            bankAccountType: changes.bankAccountType ?? this.bankAccountType,
            bankAccountHolderDocument: changes.bankAccountHolderDocument ?? this.bankAccountHolderDocument,
            isActive: changes.isActive ?? this.isActive,
            createdAt: this.createdAt,
            updatedAt: changes.updatedAt ?? new Date()
        });
    }
}

