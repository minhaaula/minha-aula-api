import { SubscriptionPlanRepository } from '../../ports/repositories/subscription-plan.repo';

type SubscriptionPlanItem = {
    id: string;
    code: string;
    name: string;
    description: string | null;
    items: string[] | null;
    amountCents: number;
    currency: string;
    billingCycle: 'MONTHLY' | 'ANNUAL';
    isActive: boolean;
};

export class ListSubscriptionPlans {
    constructor(private readonly plans: SubscriptionPlanRepository) {}

    async exec(): Promise<{ plans: SubscriptionPlanItem[] }> {
        const items = await this.plans.findActive();
        return {
            plans: items.map((plan) => ({
                id: plan.id,
                code: plan.code,
                name: plan.name,
                description: plan.description,
                items: plan.items,
                amountCents: plan.amountCents,
                currency: plan.currency,
                billingCycle: plan.billingCycle,
                isActive: plan.isActive
            }))
        };
    }
}
