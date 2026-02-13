import { describe, expect, it } from 'vitest';
import { ListSubscriptionPlans } from '../../src/app/use-cases/list-subscription-plans';
import { SubscriptionPlanRepository } from '../../src/ports/repositories/subscription-plan.repo';
import { SubscriptionPlan } from '../../src/domain/entities/subscription-plan';

class InMemoryPlanRepository implements SubscriptionPlanRepository {
    private readonly items = new Map<string, SubscriptionPlan>();

    async findActive(): Promise<SubscriptionPlan[]> {
        return Array.from(this.items.values()).filter((plan) => plan.isActive).sort((a, b) => a.amountCents - b.amountCents);
    }

    async findAll(): Promise<SubscriptionPlan[]> {
        return Array.from(this.items.values()).sort((a, b) => a.amountCents - b.amountCents);
    }

    async findById(id: string): Promise<SubscriptionPlan | null> {
        return this.items.get(id) ?? null;
    }

    async findByCode(code: string): Promise<SubscriptionPlan | null> {
        const normalized = code.trim().toUpperCase();
        return Array.from(this.items.values()).find((p) => p.code === normalized) ?? null;
    }

    async save(plan: SubscriptionPlan): Promise<void> {
        this.items.set(plan.id, plan);
    }

    seed(plan: SubscriptionPlan) {
        this.items.set(plan.id, plan);
    }
}

function makePlan(id: string, code: string, name: string, amountCents: number, isActive = true): SubscriptionPlan {
    return SubscriptionPlan.create({
        id,
        code,
        name,
        amountCents,
        currency: 'BRL',
        billingCycle: 'MONTHLY',
        isActive
    });
}

describe('ListSubscriptionPlans', () => {
    it('returns only active plans ordered by amount', async () => {
        const repo = new InMemoryPlanRepository();
        const activePlan1 = makePlan('plan-1', 'BASIC', 'Plano Básico', 15000);
        const activePlan2 = makePlan('plan-2', 'PREMIUM', 'Plano Premium', 25000);
        const inactivePlan = makePlan('plan-3', 'LEGACY', 'Plano Legado', 10000, false);

        repo.seed(activePlan1);
        repo.seed(activePlan2);
        repo.seed(inactivePlan);

        const useCase = new ListSubscriptionPlans(repo);
        const result = await useCase.exec();

        expect(result.plans).toHaveLength(2);
        expect(result.plans[0].id).toBe('plan-1');
        expect(result.plans[0].code).toBe('BASIC');
        expect(result.plans[0].name).toBe('Plano Básico');
        expect(result.plans[0].amountCents).toBe(15000);
        expect(result.plans[0].currency).toBe('BRL');
        expect(result.plans[0].billingCycle).toBe('MONTHLY');
        expect(result.plans[0].isActive).toBe(true);

        expect(result.plans[1].id).toBe('plan-2');
        expect(result.plans[1].code).toBe('PREMIUM');
        expect(result.plans[1].amountCents).toBe(25000);
    });

    it('returns empty list when no active plans exist', async () => {
        const repo = new InMemoryPlanRepository();
        const inactivePlan = makePlan('plan-1', 'LEGACY', 'Plano Legado', 10000, false);
        repo.seed(inactivePlan);

        const useCase = new ListSubscriptionPlans(repo);
        const result = await useCase.exec();

        expect(result.plans).toHaveLength(0);
    });

    it('returns empty list when repository is empty', async () => {
        const repo = new InMemoryPlanRepository();
        const useCase = new ListSubscriptionPlans(repo);
        const result = await useCase.exec();

        expect(result.plans).toHaveLength(0);
    });
});

