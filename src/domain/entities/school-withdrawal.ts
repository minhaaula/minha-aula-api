export type SchoolWithdrawalStatus = 'PROCESSING' | 'COMPLETED' | 'CANCELLED';

export class SchoolWithdrawal {
    private constructor(
        public readonly id: string,
        public readonly schoolId: string,
        public readonly amountCents: number,
        public readonly bankName: string,
        public readonly bankAgency: string,
        public readonly bankAccount: string,
        public readonly pixKey: string | null,
        private _status: SchoolWithdrawalStatus,
        private _processedAt: Date | null,
        private _cancelledAt: Date | null,
        public readonly createdAt: Date,
        public readonly updatedAt: Date,
        private _providerRef: string | null,
        private _failureReason: string | null
    ) {}

    static create(params: {
        id: string;
        schoolId: string;
        amountCents: number;
        bankName: string;
        bankAgency: string;
        bankAccount: string;
        pixKey?: string | null;
        status?: SchoolWithdrawalStatus;
        processedAt?: Date | null;
        cancelledAt?: Date | null;
        createdAt?: Date;
        updatedAt?: Date;
        providerRef?: string | null;
        failureReason?: string | null;
    }): SchoolWithdrawal {
        const schoolId = params.schoolId.trim();
        const id = params.id.trim();
        const bankName = params.bankName.trim();
        const bankAgency = params.bankAgency.trim();
        const bankAccount = params.bankAccount.trim();

        if (!id || !schoolId || !bankName || !bankAgency || !bankAccount) {
            throw new Error('Missing required fields to create school withdrawal');
        }

        const amountCents = params.amountCents;
        if (!Number.isInteger(amountCents) || amountCents <= 0) {
            throw new Error('Invalid withdrawal amount');
        }

        const pixKey = params.pixKey?.trim() || null;
        const status = params.status || 'PROCESSING';
        const processedAt = params.processedAt ?? null;
        const cancelledAt = params.cancelledAt ?? null;
        const createdAt = params.createdAt ?? new Date();
        const updatedAt = params.updatedAt ?? new Date();
        const providerRef = params.providerRef?.trim() || null;
        const failureReason = params.failureReason?.trim() || null;

        return new SchoolWithdrawal(
            id,
            schoolId,
            amountCents,
            bankName,
            bankAgency,
            bankAccount,
            pixKey,
            status,
            processedAt,
            cancelledAt,
            createdAt,
            updatedAt,
            providerRef,
            failureReason
        );
    }

    static restore(params: {
        id: string;
        schoolId: string;
        amountCents: number;
        bankName: string;
        bankAgency: string;
        bankAccount: string;
        pixKey: string | null;
        status: SchoolWithdrawalStatus;
        processedAt: Date | null;
        cancelledAt: Date | null;
        createdAt: Date;
        updatedAt: Date;
        providerRef?: string | null;
        failureReason?: string | null;
    }): SchoolWithdrawal {
        return new SchoolWithdrawal(
            params.id,
            params.schoolId,
            params.amountCents,
            params.bankName,
            params.bankAgency,
            params.bankAccount,
            params.pixKey,
            params.status,
            params.processedAt,
            params.cancelledAt,
            params.createdAt,
            params.updatedAt,
            params.providerRef ?? null,
            params.failureReason ?? null
        );
    }

    get status() {
        return this._status;
    }

    get processedAt() {
        return this._processedAt;
    }

    get cancelledAt() {
        return this._cancelledAt;
    }

    get providerRef() {
        return this._providerRef;
    }

    get failureReason() {
        return this._failureReason;
    }

    /** Define o id da transferência no Asaas (chamado logo após `POST /accounts/{id}/transfers`). */
    setProviderRef(providerRef: string): void {
        const trimmed = providerRef?.trim();
        if (!trimmed) {
            throw new Error('providerRef cannot be empty');
        }
        if (this._providerRef && this._providerRef !== trimmed) {
            throw new Error('providerRef already set with a different value');
        }
        this._providerRef = trimmed;
    }

    markAsCompleted(processedAt?: Date): void {
        if (this._status === 'COMPLETED') return; // idempotente
        if (this._status === 'CANCELLED') {
            throw new Error('Cancelled withdrawals cannot be marked as completed');
        }
        this._status = 'COMPLETED';
        this._processedAt = processedAt ?? new Date();
        this._failureReason = null;
    }

    markAsCancelled(reason?: string | null): void {
        if (this._status === 'COMPLETED') {
            throw new Error('Completed withdrawals cannot be cancelled');
        }
        if (this._status === 'CANCELLED') {
            // idempotente, mas pode atualizar a razão se ainda não havia
            if (!this._failureReason && reason && reason.trim()) {
                this._failureReason = reason.trim().slice(0, 500);
            }
            return;
        }
        this._status = 'CANCELLED';
        this._cancelledAt = new Date();
        if (reason && reason.trim()) {
            this._failureReason = reason.trim().slice(0, 500);
        }
    }
}
