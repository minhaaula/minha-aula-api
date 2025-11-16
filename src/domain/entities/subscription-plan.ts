export type SubscriptionBillingCycle = 'MONTHLY' | 'ANNUAL';

export class SubscriptionPlan {
    private constructor(
        public readonly id: string,
        public readonly code: string,
        public readonly name: string,
        public readonly amountCents: number,
        public readonly currency: string,
        public readonly description: string | null,
        public readonly items: string[] | null,
        public readonly billingCycle: SubscriptionBillingCycle,
        public readonly isActive: boolean,
        public readonly createdAt: Date,
        public readonly updatedAt: Date
    ) {}

    static create(params: {
        id: string;
        code: string;
        name: string;
        amountCents: number;
        currency: string;
        description?: string | null;
        items?: string[] | null;
        billingCycle?: SubscriptionBillingCycle;
        isActive?: boolean;
        createdAt?: Date;
        updatedAt?: Date;
    }): SubscriptionPlan {
        const id = params.id.trim();
        if (!id) throw new Error('Subscription plan id is required');

        const code = params.code.trim().toUpperCase();
        if (!code) throw new Error('Subscription plan code is required');

        const name = params.name.trim();
        if (!name) throw new Error('Subscription plan name is required');

        const amountCents = Number(params.amountCents);
        if (!Number.isInteger(amountCents) || amountCents <= 0) {
            throw new Error('Subscription plan amount must be a positive integer');
        }

        const currency = params.currency.trim().toUpperCase();
        if (!currency || currency.length !== 3) {
            throw new Error('Subscription plan currency must have 3 characters');
        }

        const description = params.description?.trim() ?? null;
        const items = params.items ?? null;
        const billingCycle = params.billingCycle ?? 'MONTHLY';
        if (billingCycle !== 'MONTHLY' && billingCycle !== 'ANNUAL') {
            throw new Error('Subscription plan billing cycle is invalid');
        }

        const isActive = params.isActive ?? true;
        const createdAt = params.createdAt ?? new Date();
        const updatedAt = params.updatedAt ?? createdAt;

        return new SubscriptionPlan(
            id,
            code,
            name,
            amountCents,
            currency,
            description,
            items,
            billingCycle,
            isActive,
            createdAt,
            updatedAt
        );
    }
}

