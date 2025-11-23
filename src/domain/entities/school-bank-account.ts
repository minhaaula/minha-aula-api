export type BankAccountType = 'CORRENTE' | 'POUPANCA';

export class SchoolBankAccount {
    private constructor(
        public readonly id: string,
        public readonly schoolId: string,
        public readonly bankName: string,
        public readonly bankCode: number | undefined,
        public readonly bankAgency: string,
        public readonly bankAgencyDigit: string | undefined,
        public readonly bankAccount: string,
        public readonly bankAccountDigit: string | undefined,
        public readonly bankAccountType: BankAccountType,
        public readonly bankAccountHolderDocument: string,
        public readonly pixKey: string | undefined,
        public readonly isActive: boolean,
        public readonly createdAt: Date,
        public readonly updatedAt: Date
    ) {}

    static create(params: {
        id: string;
        schoolId: string;
        bankName: string;
        bankCode?: number;
        bankAgency: string;
        bankAgencyDigit?: string;
        bankAccount: string;
        bankAccountDigit?: string;
        bankAccountType: BankAccountType;
        bankAccountHolderDocument: string;
        pixKey?: string;
        isActive?: boolean;
        createdAt?: Date;
        updatedAt?: Date;
    }): SchoolBankAccount {
        const id = params.id.trim();
        if (!id) throw new Error('Bank account id is required');

        const schoolId = params.schoolId.trim();
        if (!schoolId) throw new Error('School id is required');

        const bankName = SchoolBankAccount.normalizeBankName(params.bankName);
        const bankCode = SchoolBankAccount.normalizeBankCode(params.bankCode);
        const bankAgency = SchoolBankAccount.normalizeBankAgency(params.bankAgency);
        const bankAgencyDigit = SchoolBankAccount.normalizeBankAgencyDigit(params.bankAgencyDigit);
        const bankAccount = SchoolBankAccount.normalizeBankAccount(params.bankAccount);
        const bankAccountDigit = SchoolBankAccount.normalizeBankAccountDigit(params.bankAccountDigit);
        const bankAccountType = SchoolBankAccount.normalizeBankAccountType(params.bankAccountType);
        const bankAccountHolderDocument = SchoolBankAccount.normalizeBankAccountHolderDocument(params.bankAccountHolderDocument);
        const pixKey = SchoolBankAccount.normalizePixKey(params.pixKey);
        const isActive = params.isActive ?? true;
        const createdAt = params.createdAt ?? new Date();
        const updatedAt = params.updatedAt ?? createdAt;

        return new SchoolBankAccount(
            id,
            schoolId,
            bankName,
            bankCode,
            bankAgency,
            bankAgencyDigit,
            bankAccount,
            bankAccountDigit,
            bankAccountType,
            bankAccountHolderDocument,
            pixKey,
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

    private static normalizeBankCode(value: number | undefined): number | undefined {
        if (value === undefined || value === null) {
            return undefined;
        }
        if (!Number.isInteger(value) || value < 0) {
            throw new Error('Bank code must be a positive integer');
        }
        return value;
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

    private static normalizeBankAgencyDigit(value: string | undefined): string | undefined {
        if (value === undefined || value === null || value === '') {
            return undefined;
        }
        const trimmed = value.trim();
        if (trimmed.length > 2) {
            throw new Error('Bank agency digit must have at most 2 characters');
        }
        return trimmed;
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

    private static normalizeBankAccountDigit(value: string | undefined): string | undefined {
        if (value === undefined || value === null || value === '') {
            return undefined;
        }
        const trimmed = value.trim();
        if (trimmed.length > 2) {
            throw new Error('Bank account digit must have at most 2 characters');
        }
        return trimmed;
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

    private static normalizePixKey(value: string | undefined): string | undefined {
        if (value === undefined || value === null || value === '') {
            return undefined;
        }
        const trimmed = value.trim();
        if (trimmed.length > 191) {
            throw new Error('PIX key must have at most 191 characters');
        }
        return trimmed;
    }

    withChanges(changes: {
        bankName?: string;
        bankCode?: number;
        bankAgency?: string;
        bankAgencyDigit?: string;
        bankAccount?: string;
        bankAccountDigit?: string;
        bankAccountType?: BankAccountType;
        bankAccountHolderDocument?: string;
        pixKey?: string;
        isActive?: boolean;
        updatedAt?: Date;
    }): SchoolBankAccount {
        return SchoolBankAccount.create({
            id: this.id,
            schoolId: this.schoolId,
            bankName: changes.bankName ?? this.bankName,
            bankCode: changes.bankCode !== undefined ? changes.bankCode : this.bankCode,
            bankAgency: changes.bankAgency ?? this.bankAgency,
            bankAgencyDigit: changes.bankAgencyDigit !== undefined ? changes.bankAgencyDigit : this.bankAgencyDigit,
            bankAccount: changes.bankAccount ?? this.bankAccount,
            bankAccountDigit: changes.bankAccountDigit !== undefined ? changes.bankAccountDigit : this.bankAccountDigit,
            bankAccountType: changes.bankAccountType ?? this.bankAccountType,
            bankAccountHolderDocument: changes.bankAccountHolderDocument ?? this.bankAccountHolderDocument,
            pixKey: changes.pixKey !== undefined ? changes.pixKey : this.pixKey,
            isActive: changes.isActive ?? this.isActive,
            createdAt: this.createdAt,
            updatedAt: changes.updatedAt ?? new Date()
        });
    }
}

