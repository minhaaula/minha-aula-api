export type SchoolPlanInvoiceStatus = 'ISSUED' | 'PAID' | 'FAILED' | 'CANCELLED';

const VALID_STATUSES: SchoolPlanInvoiceStatus[] = ['ISSUED', 'PAID', 'FAILED', 'CANCELLED'];

export class SchoolPlanInvoice {
    private constructor(
        public readonly id: string,
        public readonly financeId: string,
        public readonly schoolId: string,
        public readonly planId: string,
        public readonly amountCents: number,
        public readonly currency: string,
        private readonly _status: SchoolPlanInvoiceStatus,
        public readonly dueDate: Date,
        public readonly description: string | null,
        public readonly providerRef: string | null,
        public readonly boletoUrl: string | null,
        public readonly digitableLine: string | null,
        public readonly barcode: string | null,
        public readonly pixQrCode: string | null,
        public readonly pixCopiaECola: string | null,
        public readonly externalReference: string | null,
        public readonly receiptUrl: string | null,
        public readonly metadata: Record<string, string>,
        public readonly paidAt: Date | null,
        public readonly discountCouponId: string | null,
        public readonly discountPercentage: number | null,
        public readonly discountAmountCents: number,
        public readonly originalAmountCents: number,
        public readonly createdAt: Date,
        public readonly updatedAt: Date
    ) {}

    static create(params: {
        id: string;
        financeId: string;
        schoolId: string;
        planId: string;
        amountCents: number;
        currency: string;
        status?: SchoolPlanInvoiceStatus;
        dueDate: Date;
        description?: string | null;
        providerRef?: string | null;
        boletoUrl?: string | null;
        digitableLine?: string | null;
        barcode?: string | null;
        pixQrCode?: string | null;
        pixCopiaECola?: string | null;
        externalReference?: string | null;
        receiptUrl?: string | null;
        metadata?: Record<string, string>;
        paidAt?: Date | null;
        discountCouponId?: string | null;
        discountPercentage?: number | null;
        discountAmountCents?: number;
        originalAmountCents?: number;
        createdAt?: Date;
        updatedAt?: Date;
    }): SchoolPlanInvoice {
        const id = params.id.trim();
        if (!id) throw new Error('School plan invoice id is required');

        const financeId = params.financeId.trim();
        if (!financeId) throw new Error('School plan invoice finance id is required');

        const schoolId = params.schoolId.trim();
        if (!schoolId) throw new Error('School plan invoice school id is required');

        const planId = params.planId.trim();
        if (!planId) throw new Error('School plan invoice plan id is required');

        const amountCents = Number(params.amountCents);
        if (!Number.isInteger(amountCents) || amountCents <= 0) {
            throw new Error('School plan invoice amount must be a positive integer');
        }

        const currency = params.currency.trim().toUpperCase();
        if (!/^[A-Z]{3}$/.test(currency)) {
            throw new Error('School plan invoice currency must be a valid ISO code');
        }

        if (!(params.dueDate instanceof Date) || Number.isNaN(params.dueDate.getTime())) {
            throw new Error('School plan invoice due date is invalid');
        }

        const status = params.status ?? 'ISSUED';
        if (!VALID_STATUSES.includes(status)) {
            throw new Error('School plan invoice status is invalid');
        }

        const description = params.description?.trim() ?? null;
        const providerRef = params.providerRef?.trim() ?? null;
        const boletoUrl = params.boletoUrl?.trim() ?? null;
        const digitableLine = params.digitableLine?.trim() ?? null;
        const barcode = params.barcode?.trim() ?? null;
        const pixQrCode = params.pixQrCode?.trim() ?? null;
        const pixCopiaECola = params.pixCopiaECola?.trim() ?? null;
        const externalReference = params.externalReference?.trim() ?? null;
        const receiptUrl = params.receiptUrl?.trim() ?? null;
        const metadata = params.metadata ? { ...params.metadata } : {};
        const paidAt = params.paidAt ?? null;
        const discountCouponId = params.discountCouponId?.trim() ?? null;
        const discountPercentage = params.discountPercentage ?? null;
        const originalAmountCents = params.originalAmountCents ?? amountCents;
        const discountAmountCents = params.discountAmountCents ?? 0;
        const createdAt = params.createdAt ?? new Date();
        const updatedAt = params.updatedAt ?? createdAt;

        return new SchoolPlanInvoice(
            id,
            financeId,
            schoolId,
            planId,
            amountCents,
            currency,
            status,
            new Date(params.dueDate),
            description,
            providerRef,
            boletoUrl,
            digitableLine,
            barcode,
            pixQrCode,
            pixCopiaECola,
            externalReference,
            receiptUrl,
            metadata,
            paidAt,
            discountCouponId,
            discountPercentage,
            discountAmountCents,
            originalAmountCents,
            createdAt,
            updatedAt
        );
    }

    get status(): SchoolPlanInvoiceStatus {
        return this._status;
    }

    withChanges(changes: {
        status?: SchoolPlanInvoiceStatus;
        paidAt?: Date | null;
        providerRef?: string | null;
        boletoUrl?: string | null;
        digitableLine?: string | null;
        barcode?: string | null;
        pixQrCode?: string | null;
        pixCopiaECola?: string | null;
        externalReference?: string | null;
        receiptUrl?: string | null;
        metadata?: Record<string, string>;
        description?: string | null;
        updatedAt?: Date;
    }): SchoolPlanInvoice {
        if (changes.status) {
            if (!VALID_STATUSES.includes(changes.status)) {
                throw new Error('School plan invoice status is invalid');
            }
            // Validar transição de estado
            if (changes.status !== this._status) {
                const { validateInvoiceStatusTransition, getInvoiceTransitionError } = require('./state-transitions');
                if (!validateInvoiceStatusTransition(this._status, changes.status)) {
                    throw new Error(getInvoiceTransitionError(this._status, changes.status));
                }
            }
        }

        const metadata = changes.metadata ? { ...changes.metadata } : { ...this.metadata };

        return new SchoolPlanInvoice(
            this.id,
            this.financeId,
            this.schoolId,
            this.planId,
            this.amountCents,
            this.currency,
            changes.status ?? this._status,
            this.dueDate,
            changes.description === undefined ? this.description : (changes.description?.trim() ?? null),
            changes.providerRef === undefined ? this.providerRef : (changes.providerRef?.trim() ?? null),
            changes.boletoUrl === undefined ? this.boletoUrl : (changes.boletoUrl?.trim() ?? null),
            changes.digitableLine === undefined ? this.digitableLine : (changes.digitableLine?.trim() ?? null),
            changes.barcode === undefined ? this.barcode : (changes.barcode?.trim() ?? null),
            changes.pixQrCode === undefined ? this.pixQrCode : (changes.pixQrCode?.trim() ?? null),
            changes.pixCopiaECola === undefined ? this.pixCopiaECola : (changes.pixCopiaECola?.trim() ?? null),
            changes.externalReference === undefined
                ? this.externalReference
                : (changes.externalReference?.trim() ?? null),
            changes.receiptUrl === undefined ? this.receiptUrl : (changes.receiptUrl?.trim() ?? null),
            metadata,
            changes.paidAt === undefined ? this.paidAt : changes.paidAt,
            this.discountCouponId,
            this.discountPercentage,
            this.discountAmountCents,
            this.originalAmountCents,
            this.createdAt,
            changes.updatedAt ?? new Date()
        );
    }
}
