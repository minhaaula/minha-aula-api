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
        public readonly updatedAt: Date
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
            updatedAt
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
            params.updatedAt
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

    markAsCompleted(processedAt?: Date): void {
        if (this._status !== 'PROCESSING') {
            throw new Error('Only processing withdrawals can be marked as completed');
        }
        this._status = 'COMPLETED';
        this._processedAt = processedAt ?? new Date();
        this.touch();
    }

    markAsCancelled(): void {
        if (this._status === 'COMPLETED') {
            throw new Error('Completed withdrawals cannot be cancelled');
        }
        this._status = 'CANCELLED';
        this._cancelledAt = new Date();
        this.touch();
    }

    private touch() {
        // Note: This is a domain entity, so we can't actually update updatedAt here
        // The repository adapter should handle this when saving
    }
}

