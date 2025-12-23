export class DiscountCoupon {
    private constructor(
        public readonly id: string,
        public readonly code: string,
        public readonly percentage: number,
        public readonly validUntil: Date,
        public readonly durationMonths: number,
        public readonly isActive: boolean,
        public readonly createdAt: Date,
        private _deletedAt: Date | null = null
    ) {}

    static create(params: {
        id: string;
        code: string;
        percentage: number;
        validUntil: Date;
        durationMonths: number;
        isActive?: boolean;
        createdAt?: Date;
        deletedAt?: Date | null;
    }) {
        const code = params.code.trim().toUpperCase();
        if (!code) throw new Error('Coupon code is required');
        if (code.length < 3 || code.length > 50) {
            throw new Error('Coupon code must be between 3 and 50 characters');
        }

        const percentage = params.percentage;
        if (percentage <= 0 || percentage > 100) {
            throw new Error('Discount percentage must be between 1 and 100');
        }

        const validUntil = new Date(params.validUntil);
        if (Number.isNaN(validUntil.getTime())) {
            throw new Error('Invalid validUntil date');
        }

        const durationMonths = params.durationMonths;
        if (durationMonths < 1) {
            throw new Error('Duration must be at least 1 month');
        }

        return new DiscountCoupon(
            params.id,
            code,
            percentage,
            validUntil,
            durationMonths,
            params.isActive ?? true,
            params.createdAt ?? new Date(),
            params.deletedAt ?? null
        );
    }

    get deletedAt(): Date | null {
        return this._deletedAt;
    }

    isExpired(): boolean {
        return new Date() > this.validUntil;
    }

    isValid(): boolean {
        return this.isActive && !this.isExpired() && !this._deletedAt;
    }

    calculateDiscount(amountCents: number): number {
        if (!this.isValid()) {
            return 0;
        }
        return Math.round((amountCents * this.percentage) / 100);
    }

    calculateDiscountedAmount(amountCents: number): number {
        const discount = this.calculateDiscount(amountCents);
        return amountCents - discount;
    }

    markAsDeleted(): void {
        this._deletedAt = new Date();
    }
}

