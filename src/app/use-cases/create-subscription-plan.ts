import { SubscriptionPlanRepository } from '../../ports/repositories/subscription-plan.repo';
import { SubscriptionPlan } from '../../domain/entities/subscription-plan';
import { Uuid } from '../../shared/uuid';
import { AppError, ErrorCode } from '../../shared/errors';

export interface CreateSubscriptionPlanInput {
    code: string;
    name: string;
    description?: string | null;
    items?: string[] | null;
    amountCents: number;
    currency: string;
    billingCycle?: 'MONTHLY' | 'ANNUAL';
    isActive?: boolean;
}

export interface CreateSubscriptionPlanOutput {
    id: string;
    code: string;
    name: string;
    description: string | null;
    items: string[] | null;
    amountCents: number;
    currency: string;
    billingCycle: 'MONTHLY' | 'ANNUAL';
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
}

export class CreateSubscriptionPlan {
    constructor(private readonly plans: SubscriptionPlanRepository) {}

    async exec(input: CreateSubscriptionPlanInput): Promise<CreateSubscriptionPlanOutput> {
        const code = input.code.trim().toUpperCase();
        const existing = await this.plans.findByCode(code);
        if (existing) {
            throw new AppError(ErrorCode.ALREADY_EXISTS, 'Já existe um plano com este código', { code });
        }

        const plan = SubscriptionPlan.create({
            id: Uuid(),
            code,
            name: input.name.trim(),
            description: input.description?.trim() ?? null,
            items: input.items ?? null,
            amountCents: input.amountCents,
            currency: input.currency.trim().toUpperCase(),
            billingCycle: input.billingCycle ?? 'MONTHLY',
            isActive: input.isActive ?? true
        });

        await this.plans.save(plan);

        return {
            id: plan.id,
            code: plan.code,
            name: plan.name,
            description: plan.description,
            items: plan.items,
            amountCents: plan.amountCents,
            currency: plan.currency,
            billingCycle: plan.billingCycle,
            isActive: plan.isActive,
            createdAt: plan.createdAt,
            updatedAt: plan.updatedAt
        };
    }
}
