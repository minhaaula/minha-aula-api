import { SubscriptionPlanRepository } from '../../ports/repositories/subscription-plan.repo';

export interface AdminSubscriptionPlanItem {
    id: string;
    code: string;
    name: string;
    description: string | null;
    items: string[] | null;
    amountCents: number;
    currency: string;
    billingCycle: 'MONTHLY' | 'ANNUAL';
    isActive: boolean;
    isPrimary: boolean;
    createdAt: Date;
    updatedAt: Date;
}

export class ListAdminSubscriptionPlans {
    constructor(private readonly plans: SubscriptionPlanRepository) {}

    async exec(): Promise<{ plans: AdminSubscriptionPlanItem[] }> {
        const items = await this.plans.findAll();
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
                isActive: plan.isActive,
                isPrimary: plan.isPrimary,
                createdAt: plan.createdAt,
                updatedAt: plan.updatedAt
            }))
        };
    }
}
