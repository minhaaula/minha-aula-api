export type SchoolFinancialChargeType = 'TUITION' | 'ENROLLMENT' | 'MATERIALS' | 'DAILY' | 'OTHER';
export type SchoolFinancialChargeStatus = 'PENDING_SYNC' | 'OPEN' | 'PAID' | 'OVERDUE' | 'CANCELLED' | 'FAILED';

export class SchoolFinancialCharge {
    private constructor(
        public readonly id: string,
        public readonly schoolId: string,
        public readonly ownerUserId: string,
        public readonly studentUserId: string | null,
        public readonly dependentId: string | null,
        public readonly courseId: string,
        public readonly courseClassId: string | null,
        public readonly chargeType: SchoolFinancialChargeType,
        private _description: string | null,
        private _amountCents: number,
        private _discountCents: number | null,
        private _discountReason: string | null,
        private _netAmountCents: number,
        private _dueDate: Date,
        private _status: SchoolFinancialChargeStatus,
        private _asaasPaymentId: string | null,
        private _asaasInvoiceUrl: string | null,
        private _asaasPayload: Record<string, unknown> | null,
        private _paidAt: Date | null,
        private _paidObservation: string | null,
        private _cancelledAt: Date | null,
        private _createdAt: Date,
        private _updatedAt: Date
    ) {}

    static create(params: {
        id: string;
        schoolId: string;
        ownerUserId: string;
        studentUserId: string | null;
        dependentId: string | null;
        courseId: string;
        courseClassId?: string | null;
        chargeType: SchoolFinancialChargeType;
        description?: string | null;
        amountCents: number;
        discountCents?: number | null;
        discountReason?: string | null;
        dueDate: Date;
    }): SchoolFinancialCharge {
        const schoolId = params.schoolId.trim();
        const ownerUserId = params.ownerUserId.trim();
        const courseId = params.courseId.trim();
        const id = params.id.trim();

        if (!id || !schoolId || !ownerUserId || !courseId) {
            throw new Error('Missing identifiers to create school financial charge');
        }

        const courseClassId = params.courseClassId?.trim() || null;
        const studentUserId = params.studentUserId?.trim() || null;
        const dependentId = params.dependentId?.trim() || null;
        if (!studentUserId && !dependentId) {
            throw new Error('Charge must target either a student or a dependent');
        }

        const amountCents = params.amountCents;
        if (!Number.isInteger(amountCents) || amountCents <= 0) {
            throw new Error('Invalid charge amount');
        }

        const discountCents = params.discountCents ?? null;
        if (discountCents !== null) {
            if (!Number.isInteger(discountCents) || discountCents < 0 || discountCents > amountCents) {
                throw new Error('Invalid charge discount');
            }
        }
        const discountReason = params.discountReason?.trim() || null;
        if (discountReason && discountCents === null) {
            throw new Error('Discount reason requires a discount value');
        }

        const dueDate = new Date(params.dueDate);
        if (Number.isNaN(dueDate.getTime())) {
            throw new Error('Invalid charge due date');
        }

        const netAmountCents = amountCents - (discountCents ?? 0);

        return new SchoolFinancialCharge(
            id,
            schoolId,
            ownerUserId,
            studentUserId,
            dependentId,
            courseId,
            courseClassId,
            params.chargeType,
            params.description?.trim() || null,
            amountCents,
            discountCents,
            discountReason,
            netAmountCents,
            dueDate,
            'PENDING_SYNC',
            null,
            null,
            null,
            null,
            null,
            null,
            new Date(),
            new Date()
        );
    }

    static restore(params: {
        id: string;
        schoolId: string;
        ownerUserId: string;
        studentUserId: string | null;
        dependentId: string | null;
        courseId: string;
        courseClassId: string | null;
        chargeType: SchoolFinancialChargeType;
        description: string | null;
        amountCents: number;
        discountCents: number | null;
        discountReason: string | null;
        netAmountCents: number;
        dueDate: Date;
        status: SchoolFinancialChargeStatus;
        asaasPaymentId: string | null;
        asaasInvoiceUrl: string | null;
        asaasPayload: Record<string, unknown> | null;
        paidAt: Date | null;
        paidObservation: string | null;
        cancelledAt: Date | null;
        createdAt: Date;
        updatedAt: Date;
    }): SchoolFinancialCharge {
        return new SchoolFinancialCharge(
            params.id,
            params.schoolId,
            params.ownerUserId,
            params.studentUserId,
            params.dependentId,
            params.courseId,
            params.courseClassId,
            params.chargeType,
            params.description,
            params.amountCents,
            params.discountCents,
            params.discountReason,
            params.netAmountCents,
            params.dueDate,
            params.status,
            params.asaasPaymentId,
            params.asaasInvoiceUrl,
            params.asaasPayload,
            params.paidAt,
            params.paidObservation,
            params.cancelledAt,
            params.createdAt,
            params.updatedAt
        );
    }

    get description() {
        return this._description;
    }

    get amountCents() {
        return this._amountCents;
    }

    get discountCents() {
        return this._discountCents;
    }

    get discountReason() {
        return this._discountReason;
    }

    get netAmountCents() {
        return this._netAmountCents;
    }

    get dueDate() {
        return this._dueDate;
    }

    get status() {
        return this._status;
    }

    get asaasPaymentId() {
        return this._asaasPaymentId;
    }

    get asaasInvoiceUrl() {
        return this._asaasInvoiceUrl;
    }

    get asaasPayload() {
        return this._asaasPayload;
    }

    get paidAt() {
        return this._paidAt;
    }

    get paidObservation() {
        return this._paidObservation;
    }

    get cancelledAt() {
        return this._cancelledAt;
    }

    get createdAt() {
        return this._createdAt;
    }

    get updatedAt() {
        return this._updatedAt;
    }

    markAsSynced(params: { paymentId: string; invoiceUrl?: string | null; payload?: Record<string, unknown> | null; }): void {
        this._status = 'OPEN';
        this._asaasPaymentId = params.paymentId;
        this._asaasInvoiceUrl = params.invoiceUrl ?? null;
        this._asaasPayload = params.payload ?? null;
        this.touch();
    }

    markAsFailed(): void {
        this._status = 'FAILED';
        this.touch();
    }

    private touch() {
        this._updatedAt = new Date();
    }
}
