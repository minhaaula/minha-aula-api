import { SubscriptionPlanRepository } from '../../ports/repositories/subscription-plan.repo';
import { SubscriptionPlan } from '../../domain/entities/subscription-plan';
import { AppError, ErrorCode } from '../../shared/errors';

export interface UpdateSubscriptionPlanInput {
    planId: string;
    code?: string;
    name?: string;
    description?: string | null;
    items?: string[] | null;
    amountCents?: number;
    currency?: string;
    billingCycle?: 'MONTHLY' | 'ANNUAL';
    isActive?: boolean;
    isPrimary?: boolean;
}

export interface UpdateSubscriptionPlanOutput {
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

export class UpdateSubscriptionPlan {
    constructor(private readonly plans: SubscriptionPlanRepository) {}

    async exec(input: UpdateSubscriptionPlanInput): Promise<UpdateSubscriptionPlanOutput> {
        const existing = await this.plans.findById(input.planId);
        if (!existing) {
            throw AppError.notFound('Plano', { planId: input.planId });
        }

        if (input.code !== undefined) {
            const code = input.code.trim().toUpperCase();
            const byCode = await this.plans.findByCode(code);
            if (byCode && byCode.id !== existing.id) {
                throw new AppError(ErrorCode.ALREADY_EXISTS, 'Já existe um plano com este código', { code });
            }
        }

        const plan = SubscriptionPlan.create({
            id: existing.id,
            code: input.code !== undefined ? input.code.trim().toUpperCase() : existing.code,
            name: input.name !== undefined ? input.name.trim() : existing.name,
            description: input.description !== undefined ? (input.description?.trim() ?? null) : existing.description,
            items: input.items !== undefined ? input.items : existing.items,
            amountCents: input.amountCents !== undefined ? input.amountCents : existing.amountCents,
            currency: input.currency !== undefined ? input.currency.trim().toUpperCase() : existing.currency,
            billingCycle: input.billingCycle ?? existing.billingCycle,
            isActive: input.isActive !== undefined ? input.isActive : existing.isActive,
            isPrimary: input.isPrimary !== undefined ? input.isPrimary : existing.isPrimary,
            createdAt: existing.createdAt,
            updatedAt: new Date()
        });

        await this.plans.save(plan);

        if (plan.isPrimary) {
            await this.clearOtherPrimary(plan.id);
        }

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
            isPrimary: plan.isPrimary,
            createdAt: plan.createdAt,
            updatedAt: plan.updatedAt
        };
    }

    private async clearOtherPrimary(keepPlanId: string): Promise<void> {
        const all = await this.plans.findAll();
        for (const p of all) {
            if (p.id !== keepPlanId && p.isPrimary) {
                await this.plans.save(SubscriptionPlan.create({
                    id: p.id,
                    code: p.code,
                    name: p.name,
                    description: p.description,
                    items: p.items,
                    amountCents: p.amountCents,
                    currency: p.currency,
                    billingCycle: p.billingCycle,
                    isActive: p.isActive,
                    isPrimary: false,
                    createdAt: p.createdAt,
                    updatedAt: new Date()
                }));
            }
        }
    }
}
