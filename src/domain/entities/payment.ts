import { Money } from '../value-objects/money';
export type PaymentStatus = 'CREATED'|'AUTHORIZED'|'CAPTURED'|'FAILED';
export type PaymentMethod = 'CARD'|'PIX'|'BOLETO';

export class Payment {
    private constructor(
        public readonly id: string,
        private _status: PaymentStatus,
        public readonly amount: Money,
        public readonly method: PaymentMethod,
        public readonly customerId: string,
        public readonly metadata: Record<string,string> = {},
        public providerRef: string | null = null,
        public version: number = 0,
        public enrollmentId: string | null = null
    ) {}

    static create(params: {
        id: string; amount: Money;
        method: PaymentMethod; 
        customerId: string; 
        metadata?: Record<string,string>;
        enrollmentId?: string | null;
    }) {
        return new Payment(
            params.id,
            'CREATED',
            params.amount,
            params.method,
            params.customerId,
            params.metadata ?? {},
            null,
            0,
            params.enrollmentId ?? null
        );
    }

    get status() { return this._status; }

    authorize(providerRef: string) {
        if (this._status !== 'CREATED') throw new Error('Invalid transition');
        this.providerRef = providerRef;
        this._status = 'AUTHORIZED';
        this.version++;
    }

    capture() {
        if (this._status !== 'AUTHORIZED') throw new Error('Invalid transition');
        this._status = 'CAPTURED';
        this.version++;
    }

    fail() {
        if (this._status === 'CAPTURED') throw new Error('Cannot fail captured payment');
        this._status = 'FAILED';
        this.version++;
    }

}
