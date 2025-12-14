import { PostalAddress } from '../value-objects/postal-address';
import { Email } from '../value-objects/email';

export class School {
    private constructor(
        public readonly id: string,
        public readonly name: string,
        private readonly _addresses: PostalAddress[],
        public readonly createdAt: Date,
        private readonly _email: Email,
        private readonly _phone: string,
        private readonly _cnpj: string,
        private readonly _ownerUserId: string | null,
        private readonly _ownerName: string | null,
        private readonly _ownerCpf: string | null,
        private readonly _ownerEmail: Email | null,
        private readonly _ownerPasswordHash: string | null,
        private readonly _accountId: string | null,
        private readonly _accountApiKey: string | null,
        private readonly _walletId: string | null,
        private readonly _incomeValue: number
    ) {}

    static create(params: {
        id: string;
        name: string;
        email: string;
        phone: string;
        cnpj: string;
        addresses?: PostalAddress[];
        ownerUserId?: string | null;
        createdAt?: Date;
        ownerName?: string | null;
        ownerCpf?: string | null;
        ownerEmail?: string | null;
        ownerPasswordHash?: string | null;
        accountId?: string | null;
        accountApiKey?: string | null;
        walletId?: string | null;
        incomeValue?: number;
    }) {
        const name = params.name.trim();
        if (!name) throw new Error('School name is required');

        const addresses = params.addresses ?? [];
        if (!Array.isArray(addresses)) throw new Error('School addresses must be an array');
        for (const address of addresses) {
            if (!(address instanceof PostalAddress)) {
                throw new Error('Invalid school address');
            }
        }

        const email = Email.create(params.email);
        const phone = School.normalizePhone(params.phone);
        const cnpj = School.normalizeCnpj(params.cnpj);

        const ownerUserId = params.ownerUserId ? params.ownerUserId.trim() : null;
        const ownerName = School.normalizeOwnerName(params.ownerName);
        const ownerCpf = School.normalizeOwnerCpf(params.ownerCpf);
        const ownerEmail = School.normalizeOwnerEmail(params.ownerEmail);
        const ownerPasswordHash = School.normalizeOwnerPasswordHash(params.ownerPasswordHash);
        const accountId = School.normalizeAccountId(params.accountId);
        const accountApiKey = School.normalizeAccountApiKey(params.accountApiKey);
        const walletId = School.normalizeWalletId(params.walletId);
        const incomeValue = School.normalizeIncomeValue(params.incomeValue);

        return new School(
            params.id,
            name,
            [...addresses],
            params.createdAt ?? new Date(),
            email,
            phone,
            cnpj,
            ownerUserId && ownerUserId.length ? ownerUserId : null,
            ownerName,
            ownerCpf,
            ownerEmail,
            ownerPasswordHash,
            accountId,
            accountApiKey,
            walletId,
            incomeValue
        );
    }

    get addresses(): PostalAddress[] {
        return [...this._addresses];
    }

    get email(): string {
        return this._email.value;
    }

    get phone(): string {
        return this._phone;
    }

    get cnpj(): string {
        return this._cnpj;
    }

    get ownerUserId(): string | null {
        return this._ownerUserId;
    }

    get ownerName(): string | null {
        return this._ownerName;
    }

    get ownerCpf(): string | null {
        return this._ownerCpf;
    }

    get ownerEmail(): string | null {
        return this._ownerEmail ? this._ownerEmail.value : null;
    }

    get ownerPasswordHash(): string | null {
        return this._ownerPasswordHash;
    }

    get accountId(): string | null {
        return this._accountId;
    }

    get accountApiKey(): string | null {
        return this._accountApiKey;
    }

    get walletId(): string | null {
        return this._walletId;
    }

    get incomeValue(): number {
        return this._incomeValue;
    }

    private static normalizePhone(value: string) {
        const digits = value.replace(/\D/g, '');
        if (digits.length < 10 || digits.length > 15) {
            throw new Error('Invalid school phone');
        }
        return digits;
    }

    private static normalizeCnpj(value: string) {
        const digits = value.replace(/\D/g, '');
        if (digits.length !== 14) {
            throw new Error('Invalid school CNPJ');
        }
        return digits;
    }

    private static normalizeOwnerName(value: unknown): string | null {
        if (value === undefined || value === null) return null;
        if (typeof value !== 'string') {
            throw new Error('School owner name must be a string');
        }
        const trimmed = value.trim();
        if (!trimmed) {
            throw new Error('School owner name cannot be empty');
        }
        return trimmed;
    }

    private static normalizeOwnerCpf(value: unknown): string | null {
        if (value === undefined || value === null) return null;
        if (typeof value !== 'string') {
            throw new Error('School owner CPF must be a string');
        }
        const digits = value.replace(/\D/g, '');
        if (digits.length !== 11) {
            throw new Error('Invalid school owner CPF');
        }
        return digits;
    }

    private static normalizeOwnerEmail(value: unknown): Email | null {
        if (value === undefined || value === null) return null;
        if (typeof value !== 'string') {
            throw new Error('School owner email must be a string');
        }
        return Email.create(value);
    }

    private static normalizeOwnerPasswordHash(value: unknown): string | null {
        if (value === undefined || value === null) return null;
        if (typeof value !== 'string') {
            throw new Error('School owner password hash must be a string');
        }
        const trimmed = value.trim();
        if (!trimmed) {
            throw new Error('School owner password hash cannot be empty');
        }
        return trimmed;
    }

    private static normalizeAccountId(value: unknown): string | null {
        if (value === undefined || value === null) return null;
        if (typeof value !== 'string') {
            throw new Error('School account id must be a string');
        }
        const trimmed = value.trim();
        if (!trimmed) {
            throw new Error('School account id cannot be empty');
        }
        return trimmed;
    }

    private static normalizeAccountApiKey(value: unknown): string | null {
        if (value === undefined || value === null) return null;
        if (typeof value !== 'string') {
            throw new Error('School account API key must be a string');
        }
        const trimmed = value.trim();
        if (!trimmed) {
            return null;
        }
        return trimmed;
    }

    private static normalizeWalletId(value: unknown): string | null {
        if (value === undefined || value === null) return null;
        if (typeof value !== 'string') {
            throw new Error('School wallet id must be a string');
        }
        const trimmed = value.trim();
        if (!trimmed) {
            return null;
        }
        return trimmed;
    }

    private static normalizeIncomeValue(value: unknown): number {
        const DEFAULT_INCOME = 5000;
        if (value === undefined || value === null) {
            return DEFAULT_INCOME;
        }
        const numeric = typeof value === 'string' ? Number(value) : value;
        if (typeof numeric !== 'number' || Number.isNaN(numeric) || numeric <= 0) {
            throw new Error('School income value must be a positive number');
        }
        return Math.round(numeric);
    }

    withAccountId(accountId: string): School {
        const normalized = School.normalizeAccountId(accountId);
        return School.create({
            id: this.id,
            name: this.name,
            email: this.email,
            phone: this.phone,
            cnpj: this.cnpj,
            addresses: this.addresses,
            ownerUserId: this.ownerUserId,
            ownerName: this.ownerName,
            ownerCpf: this.ownerCpf,
            ownerEmail: this.ownerEmail,
            ownerPasswordHash: this.ownerPasswordHash,
            createdAt: this.createdAt,
            accountId: normalized,
            accountApiKey: this._accountApiKey,
            walletId: this._walletId,
            incomeValue: this._incomeValue
        });
    }

    withAccountApiKey(accountApiKey: string | null): School {
        const normalized = School.normalizeAccountApiKey(accountApiKey);
        return School.create({
            id: this.id,
            name: this.name,
            email: this.email,
            phone: this.phone,
            cnpj: this.cnpj,
            addresses: this.addresses,
            ownerUserId: this.ownerUserId,
            ownerName: this.ownerName,
            ownerCpf: this.ownerCpf,
            ownerEmail: this.ownerEmail,
            ownerPasswordHash: this.ownerPasswordHash,
            createdAt: this.createdAt,
            accountId: this._accountId,
            accountApiKey: normalized,
            walletId: this._walletId,
            incomeValue: this._incomeValue
        });
    }

    withWalletId(walletId: string | null): School {
        const normalized = School.normalizeWalletId(walletId);
        return School.create({
            id: this.id,
            name: this.name,
            email: this.email,
            phone: this.phone,
            cnpj: this.cnpj,
            addresses: this.addresses,
            ownerUserId: this.ownerUserId,
            ownerName: this.ownerName,
            ownerCpf: this.ownerCpf,
            ownerEmail: this.ownerEmail,
            ownerPasswordHash: this.ownerPasswordHash,
            createdAt: this.createdAt,
            accountId: this._accountId,
            accountApiKey: this._accountApiKey,
            walletId: normalized,
            incomeValue: this._incomeValue
        });
    }
}
