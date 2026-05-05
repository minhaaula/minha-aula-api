import { PostalAddress } from '../value-objects/postal-address';
import { Email } from '../value-objects/email';

/**
 * Snapshot do status cadastral da subconta Asaas (white-label).
 * Reflete o payload `accountStatus` dos webhooks `ACCOUNT_STATUS_*` e/ou GET /v3/myAccount/status.
 *
 * Cada campo aceita valores como `APPROVED`, `AWAITING_APPROVAL`, `PENDING`, `REJECTED`
 * (definidos pela API do Asaas em "Consultar situação cadastral da conta").
 */
export type SchoolAccountStatusSnapshot = {
    commercialInfo?: string | null;
    bankAccountInfo?: string | null;
    documentation?: string | null;
    general?: string | null;
    /** Último evento ACCOUNT_STATUS_* recebido (ex.: ACCOUNT_STATUS_DOCUMENT_REJECTED). */
    lastEvent?: string | null;
    /** ISO timestamp do último evento processado. */
    lastEventAt?: string | null;
};

/** Somente os quatro pilares do KYC Asaas (usado para detectar mudança real de status). */
export type SchoolAccountStatusSections = Pick<
    SchoolAccountStatusSnapshot,
    'commercialInfo' | 'bankAccountInfo' | 'documentation' | 'general'
>;

export function schoolAccountStatusSectionSlice(
    s: SchoolAccountStatusSnapshot | null | undefined
): SchoolAccountStatusSections {
    return {
        commercialInfo: s?.commercialInfo ?? null,
        bankAccountInfo: s?.bankAccountInfo ?? null,
        documentation: s?.documentation ?? null,
        general: s?.general ?? null
    };
}

/** Compara só commercialInfo, bankAccountInfo, documentation e general (normaliza null / string vazia). */
export function schoolAccountStatusSectionsEqual(
    a: SchoolAccountStatusSnapshot | null | undefined,
    b: SchoolAccountStatusSnapshot | null | undefined
): boolean {
    const A = schoolAccountStatusSectionSlice(a);
    const B = schoolAccountStatusSectionSlice(b);
    return (
        (A.commercialInfo ?? '') === (B.commercialInfo ?? '') &&
        (A.bankAccountInfo ?? '') === (B.bankAccountInfo ?? '') &&
        (A.documentation ?? '') === (B.documentation ?? '') &&
        (A.general ?? '') === (B.general ?? '')
    );
}

export class School {
    private constructor(
        public readonly id: string,
        public readonly name: string,
        private readonly _addresses: PostalAddress[],
        public readonly createdAt: Date,
        private readonly _email: Email,
        private readonly _phone: string,
        private readonly _cnpj: string | null,
        private readonly _ownerUserId: string | null,
        private readonly _ownerName: string | null,
        private readonly _ownerCpf: string | null,
        private readonly _ownerEmail: Email | null,
        /** Data de nascimento do titular (obrigatória no cadastro quando não há CNPJ; usada na subconta Asaas PF). */
        private readonly _ownerBirthDate: Date | null,
        /** Celular WhatsApp do responsável (somente dígitos, mesmo formato de `phone`). */
        private readonly _ownerWhatsapp: string | null,
        private readonly _ownerPasswordHash: string | null,
        private readonly _accountId: string | null,
        private readonly _accountApiKey: string | null,
        private readonly _walletId: string | null,
        private readonly _onboardingUrl: string | null,
        private readonly _onboardingUrlExpiresAt: Date | null,
        private readonly _incomeValue: number,
        private readonly _facebookLink: string | null,
        private readonly _instagramLink: string | null,
        private readonly _tiktokLink: string | null,
        private readonly _youtubeLink: string | null,
        private readonly _siteLink: string | null,
        private readonly _onboardingCompletedAt: Date | null,
        private readonly _notificationsEmailEnabled: boolean,
        private readonly _notificationsWhatsappEnabled: boolean,
        private readonly _notificationsPushEnabled: boolean,
        /** Snapshot do último status cadastral da subconta Asaas recebido via webhook. */
        private readonly _accountStatusSnapshot: SchoolAccountStatusSnapshot | null
    ) {}

    static create(params: {
        id: string;
        name: string;
        email: string;
        phone: string;
        cnpj?: string | null;
        addresses?: PostalAddress[];
        ownerUserId?: string | null;
        createdAt?: Date;
        ownerName?: string | null;
        ownerCpf?: string | null;
        ownerEmail?: string | null;
        ownerBirthDate?: string | Date | null;
        ownerWhatsapp?: string | null;
        ownerPasswordHash?: string | null;
        accountId?: string | null;
        accountApiKey?: string | null;
        walletId?: string | null;
        onboardingUrl?: string | null;
        onboardingUrlExpiresAt?: string | Date | null;
        incomeValue?: number;
        facebookLink?: string | null;
        instagramLink?: string | null;
        tiktokLink?: string | null;
        youtubeLink?: string | null;
        siteLink?: string | null;
        onboardingCompletedAt?: Date | null;
        notificationsEmailEnabled?: boolean;
        notificationsWhatsappEnabled?: boolean;
        notificationsPushEnabled?: boolean;
        accountStatusSnapshot?: SchoolAccountStatusSnapshot | null;
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
        const ownerBirthDate = School.normalizeOwnerBirthDate(params.ownerBirthDate);
        const ownerWhatsapp = School.normalizeOwnerWhatsapp(params.ownerWhatsapp);
        const ownerPasswordHash = School.normalizeOwnerPasswordHash(params.ownerPasswordHash);
        const accountId = School.normalizeAccountId(params.accountId);
        const accountApiKey = School.normalizeAccountApiKey(params.accountApiKey);
        const walletId = School.normalizeWalletId(params.walletId);
        const onboardingUrl = School.normalizeLink(params.onboardingUrl);
        const onboardingUrlExpiresAt = School.normalizeOnboardingUrlExpiresAt(params.onboardingUrlExpiresAt);
        const incomeValue = School.normalizeIncomeValue(params.incomeValue);
        const facebookLink = School.normalizeLink(params.facebookLink);
        const instagramLink = School.normalizeLink(params.instagramLink);
        const tiktokLink = School.normalizeLink(params.tiktokLink);
        const youtubeLink = School.normalizeLink(params.youtubeLink);
        const siteLink = School.normalizeLink(params.siteLink);
        const onboardingCompletedAt = params.onboardingCompletedAt ?? null;
        const notificationsEmailEnabled = School.normalizePreference(params.notificationsEmailEnabled, true);
        const notificationsWhatsappEnabled = School.normalizePreference(params.notificationsWhatsappEnabled, true);
        const notificationsPushEnabled = School.normalizePreference(params.notificationsPushEnabled, true);
        const accountStatusSnapshot = School.normalizeAccountStatusSnapshot(params.accountStatusSnapshot);

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
            ownerBirthDate,
            ownerWhatsapp,
            ownerPasswordHash,
            accountId,
            accountApiKey,
            walletId,
            onboardingUrl,
            onboardingUrlExpiresAt,
            incomeValue,
            facebookLink,
            instagramLink,
            tiktokLink,
            youtubeLink,
            siteLink,
            onboardingCompletedAt,
            notificationsEmailEnabled,
            notificationsWhatsappEnabled,
            notificationsPushEnabled,
            accountStatusSnapshot
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

    get cnpj(): string | null {
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

    get ownerBirthDate(): Date | null {
        return this._ownerBirthDate;
    }

    get ownerWhatsapp(): string | null {
        return this._ownerWhatsapp;
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

    get onboardingUrl(): string | null {
        return this._onboardingUrl;
    }

    get onboardingUrlExpiresAt(): Date | null {
        return this._onboardingUrlExpiresAt;
    }

    get incomeValue(): number {
        return this._incomeValue;
    }

    get facebookLink(): string | null {
        return this._facebookLink;
    }

    get instagramLink(): string | null {
        return this._instagramLink;
    }

    get tiktokLink(): string | null {
        return this._tiktokLink;
    }

    get youtubeLink(): string | null {
        return this._youtubeLink;
    }

    get siteLink(): string | null {
        return this._siteLink;
    }

    get onboardingCompletedAt(): Date | null {
        return this._onboardingCompletedAt;
    }

    get notificationsEmailEnabled(): boolean {
        return this._notificationsEmailEnabled;
    }

    get notificationsWhatsappEnabled(): boolean {
        return this._notificationsWhatsappEnabled;
    }

    get notificationsPushEnabled(): boolean {
        return this._notificationsPushEnabled;
    }

    get accountStatusSnapshot(): SchoolAccountStatusSnapshot | null {
        return this._accountStatusSnapshot ? { ...this._accountStatusSnapshot } : null;
    }

    private static normalizePhone(value: string) {
        const digits = value.replace(/\D/g, '');
        if (digits.length < 10 || digits.length > 15) {
            throw new Error('Invalid school phone');
        }
        return digits;
    }

    private static normalizeCnpj(value: unknown): string | null {
        if (value === undefined || value === null) return null;
        if (typeof value !== 'string') {
            throw new Error('School CNPJ must be a string');
        }
        const digits = value.replace(/\D/g, '');
        if (digits.length === 0) return null;
        if (digits.length !== 14) {
            throw new Error('Invalid school CNPJ');
        }
        return digits;
    }

    private static normalizeOnboardingUrlExpiresAt(value: unknown): Date | null {
        if (value === undefined || value === null) return null;
        if (value instanceof Date) {
            return Number.isFinite(value.getTime()) ? value : null;
        }
        if (typeof value === 'string') {
            const trimmed = value.trim();
            if (!trimmed) return null;
            const d = new Date(trimmed);
            return Number.isFinite(d.getTime()) ? d : null;
        }
        throw new Error('School onboardingUrlExpiresAt must be a Date or ISO string');
    }

    /**
     * Preferências vêm do MySQL como `tinyint` (0/1); drivers costumam entregar `number`, não `boolean`.
     */
    private static normalizePreference(value: unknown, defaultValue: boolean): boolean {
        if (value === undefined || value === null) return defaultValue;
        if (typeof value === 'boolean') return value;
        if (typeof value === 'number') {
            if (value === 1) return true;
            if (value === 0) return false;
            throw new Error('School notification preference must be a boolean');
        }
        if (typeof value === 'string') {
            if (value === '1') return true;
            if (value === '0') return false;
            throw new Error('School notification preference must be a boolean');
        }
        if (Buffer.isBuffer(value) && value.length === 1) {
            const b = value[0];
            if (b === 1) return true;
            if (b === 0) return false;
        }
        throw new Error('School notification preference must be a boolean');
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

    private static normalizeOwnerBirthDate(value: unknown): Date | null {
        if (value === undefined || value === null) return null;
        if (value instanceof Date) {
            if (Number.isNaN(value.getTime())) {
                throw new Error('Invalid school owner birth date');
            }
            const y = value.getUTCFullYear();
            const m = value.getUTCMonth();
            const d = value.getUTCDate();
            return new Date(Date.UTC(y, m, d));
        }
        if (typeof value !== 'string') {
            throw new Error('School owner birth date must be a string or Date');
        }
        const trimmed = value.trim();
        if (!trimmed) return null;
        const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
        if (!match) {
            throw new Error('School owner birth date must be YYYY-MM-DD');
        }
        const y = Number(match[1]);
        const mo = Number(match[2]);
        const d = Number(match[3]);
        const dt = new Date(Date.UTC(y, mo - 1, d));
        if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) {
            throw new Error('Invalid school owner birth date');
        }
        return dt;
    }

    private static normalizeOwnerWhatsapp(value: unknown): string | null {
        if (value === undefined || value === null) return null;
        if (typeof value !== 'string') {
            throw new Error('School owner WhatsApp must be a string');
        }
        const digits = value.replace(/\D/g, '');
        if (digits.length === 0) return null;
        if (digits.length < 10 || digits.length > 15) {
            throw new Error('Invalid school owner WhatsApp');
        }
        return digits;
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

    private static normalizeAccountStatusSnapshot(value: unknown): SchoolAccountStatusSnapshot | null {
        if (value === undefined || value === null) return null;
        if (typeof value === 'string') {
            try {
                const parsed = JSON.parse(value);
                return School.normalizeAccountStatusSnapshot(parsed);
            } catch {
                return null;
            }
        }
        if (typeof value !== 'object' || Array.isArray(value)) return null;
        const v = value as Record<string, unknown>;
        const pickStr = (key: string): string | null => {
            const raw = v[key];
            if (raw === undefined || raw === null) return null;
            if (typeof raw !== 'string') return null;
            const trimmed = raw.trim();
            return trimmed ? trimmed : null;
        };
        const snapshot: SchoolAccountStatusSnapshot = {
            commercialInfo: pickStr('commercialInfo'),
            bankAccountInfo: pickStr('bankAccountInfo'),
            documentation: pickStr('documentation'),
            general: pickStr('general'),
            lastEvent: pickStr('lastEvent'),
            lastEventAt: pickStr('lastEventAt')
        };
        const hasAny = Object.values(snapshot).some((v) => v !== null && v !== undefined);
        return hasAny ? snapshot : null;
    }

    private static normalizeLink(value: unknown): string | null {
        if (value === undefined || value === null) return null;
        if (typeof value !== 'string') {
            throw new Error('Link must be a string');
        }
        const trimmed = value.trim();
        if (!trimmed) return null;
        return trimmed;
    }

    /**
     * Helper interno para reduzir duplicação entre os métodos `with*`.
     * Recebe somente os campos que mudaram; os demais são preservados do estado atual.
     */
    private withChanges(overrides: Partial<{
        accountId: string | null;
        accountApiKey: string | null;
        walletId: string | null;
        onboardingUrl: string | null;
        onboardingUrlExpiresAt: Date | null;
        onboardingCompletedAt: Date | null;
        accountStatusSnapshot: SchoolAccountStatusSnapshot | null;
    }>): School {
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
            ownerBirthDate: this._ownerBirthDate,
            ownerWhatsapp: this.ownerWhatsapp,
            ownerPasswordHash: this.ownerPasswordHash,
            createdAt: this.createdAt,
            accountId: overrides.accountId !== undefined ? overrides.accountId : this._accountId,
            accountApiKey: overrides.accountApiKey !== undefined ? overrides.accountApiKey : this._accountApiKey,
            walletId: overrides.walletId !== undefined ? overrides.walletId : this._walletId,
            onboardingUrl: overrides.onboardingUrl !== undefined ? overrides.onboardingUrl : this._onboardingUrl,
            onboardingUrlExpiresAt:
                overrides.onboardingUrlExpiresAt !== undefined ? overrides.onboardingUrlExpiresAt : this._onboardingUrlExpiresAt,
            incomeValue: this._incomeValue,
            facebookLink: this._facebookLink,
            instagramLink: this._instagramLink,
            tiktokLink: this._tiktokLink,
            youtubeLink: this._youtubeLink,
            siteLink: this._siteLink,
            onboardingCompletedAt:
                overrides.onboardingCompletedAt !== undefined ? overrides.onboardingCompletedAt : this._onboardingCompletedAt,
            notificationsEmailEnabled: this._notificationsEmailEnabled,
            notificationsWhatsappEnabled: this._notificationsWhatsappEnabled,
            notificationsPushEnabled: this._notificationsPushEnabled,
            accountStatusSnapshot:
                overrides.accountStatusSnapshot !== undefined ? overrides.accountStatusSnapshot : this._accountStatusSnapshot
        });
    }

    withAccountId(accountId: string): School {
        return this.withChanges({ accountId: School.normalizeAccountId(accountId) });
    }

    withAccountApiKey(accountApiKey: string | null): School {
        return this.withChanges({ accountApiKey: School.normalizeAccountApiKey(accountApiKey) });
    }

    withWalletId(walletId: string | null): School {
        return this.withChanges({ walletId: School.normalizeWalletId(walletId) });
    }

    withOnboardingUrl(onboardingUrl: string | null): School {
        return this.withChanges({ onboardingUrl: School.normalizeLink(onboardingUrl) });
    }

    withOnboardingUrlExpiresAt(expiresAt: Date | null): School {
        return this.withChanges({ onboardingUrlExpiresAt: expiresAt });
    }

    withOnboardingCompletedAt(completedAt: Date | null): School {
        return this.withChanges({ onboardingCompletedAt: completedAt });
    }

    /**
     * Atualiza o snapshot do status cadastral da subconta Asaas (white-label).
     * Faz merge com o snapshot atual para preservar campos que não vieram no evento.
     */
    withAccountStatusSnapshot(partial: SchoolAccountStatusSnapshot | null): School {
        if (!partial) {
            return this.withChanges({ accountStatusSnapshot: null });
        }
        const current = this._accountStatusSnapshot ?? {};
        const merged: SchoolAccountStatusSnapshot = {
            commercialInfo: partial.commercialInfo ?? current.commercialInfo ?? null,
            bankAccountInfo: partial.bankAccountInfo ?? current.bankAccountInfo ?? null,
            documentation: partial.documentation ?? current.documentation ?? null,
            general: partial.general ?? current.general ?? null,
            lastEvent: partial.lastEvent ?? current.lastEvent ?? null,
            lastEventAt: partial.lastEventAt ?? current.lastEventAt ?? null
        };
        return this.withChanges({ accountStatusSnapshot: merged });
    }
}
