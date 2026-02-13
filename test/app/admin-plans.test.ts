import { describe, expect, it } from 'vitest';
import { ListAdminSubscriptionPlans } from '../../src/app/use-cases/list-admin-subscription-plans';
import { CreateSubscriptionPlan } from '../../src/app/use-cases/create-subscription-plan';
import { UpdateSubscriptionPlan } from '../../src/app/use-cases/update-subscription-plan';
import { SubscriptionPlanRepository } from '../../src/ports/repositories/subscription-plan.repo';
import { SubscriptionPlan } from '../../src/domain/entities/subscription-plan';
import { AppError, ErrorCode } from '../../src/shared/errors';

class InMemorySubscriptionPlanRepository implements SubscriptionPlanRepository {
    private readonly items = new Map<string, SubscriptionPlan>();

    async findActive(): Promise<SubscriptionPlan[]> {
        return Array.from(this.items.values())
            .filter((p) => p.isActive)
            .sort((a, b) => a.amountCents - b.amountCents);
    }

    async findAll(): Promise<SubscriptionPlan[]> {
        return Array.from(this.items.values()).sort((a, b) => a.amountCents - b.amountCents);
    }

    async findById(id: string): Promise<SubscriptionPlan | null> {
        return this.items.get(id.trim()) ?? null;
    }

    async findByCode(code: string): Promise<SubscriptionPlan | null> {
        const normalized = code.trim().toUpperCase();
        return Array.from(this.items.values()).find((p) => p.code === normalized) ?? null;
    }

    async save(plan: SubscriptionPlan): Promise<void> {
        this.items.set(plan.id, plan);
    }
}

describe('Admin Plans CRUD (integração)', () => {
    const repo = new InMemorySubscriptionPlanRepository();
    const listPlans = new ListAdminSubscriptionPlans(repo);
    const createPlan = new CreateSubscriptionPlan(repo);
    const updatePlan = new UpdateSubscriptionPlan(repo);

    it('lista vazio, cadastra plano, lista com um item e retorna dados corretos', async () => {
        const listBefore = await listPlans.exec();
        expect(listBefore.plans).toHaveLength(0);

        const created = await createPlan.exec({
            code: 'BASIC',
            name: 'Plano Básico',
            description: 'Para escolas pequenas',
            amountCents: 9900,
            isActive: true
        });

        expect(created.id).toBeDefined();
        expect(created.code).toBe('BASIC');
        expect(created.name).toBe('Plano Básico');
        expect(created.description).toBe('Para escolas pequenas');
        expect(created.amountCents).toBe(9900);
        expect(created.currency).toBe('BRL');
        expect(created.billingCycle).toBe('MONTHLY');
        expect(created.isActive).toBe(true);
        expect(created.createdAt).toBeInstanceOf(Date);
        expect(created.updatedAt).toBeInstanceOf(Date);

        const listAfter = await listPlans.exec();
        expect(listAfter.plans).toHaveLength(1);
        expect(listAfter.plans[0].id).toBe(created.id);
        expect(listAfter.plans[0].code).toBe('BASIC');
        expect(listAfter.plans[0].name).toBe('Plano Básico');
        expect(listAfter.plans[0].amountCents).toBe(9900);
        expect(listAfter.plans[0].createdAt).toBeDefined();
        expect(listAfter.plans[0].updatedAt).toBeDefined();
    });

    it('edita plano existente e lista reflete alteração', async () => {
        const created = await createPlan.exec({
            code: 'PRO',
            name: 'Plano Pro',
            amountCents: 19900
        });

        const updated = await updatePlan.exec({
            planId: created.id,
            name: 'Plano Pro Atualizado',
            amountCents: 22900,
            isActive: false
        });

        expect(updated.id).toBe(created.id);
        expect(updated.code).toBe('PRO');
        expect(updated.name).toBe('Plano Pro Atualizado');
        expect(updated.amountCents).toBe(22900);
        expect(updated.isActive).toBe(false);
        expect(updated.createdAt.getTime()).toBe(created.createdAt.getTime());
        expect(updated.updatedAt.getTime()).toBeGreaterThanOrEqual(created.updatedAt.getTime());

        const list = await listPlans.exec();
        const found = list.plans.find((p) => p.id === created.id);
        expect(found?.name).toBe('Plano Pro Atualizado');
        expect(found?.amountCents).toBe(22900);
        expect(found?.isActive).toBe(false);
    });

    it('create falha com ALREADY_EXISTS quando código já existe', async () => {
        await createPlan.exec({
            code: 'UNICO',
            name: 'Único',
            amountCents: 5000,
            currency: 'BRL'
        });

        await expect(
            createPlan.exec({
                code: 'unico',
                name: 'Outro',
                amountCents: 6000,
                currency: 'BRL'
            })
        ).rejects.toMatchObject({ code: ErrorCode.ALREADY_EXISTS });
    });

    it('update falha com NOT_FOUND quando planId não existe', async () => {
        const fakeId = '00000000-0000-0000-0000-000000000000';

        await expect(
            updatePlan.exec({
                planId: fakeId,
                name: 'Qualquer'
            })
        ).rejects.toMatchObject({
            code: ErrorCode.NOT_FOUND,
            message: expect.stringContaining('Plano')
        });
    });

    it('update falha com ALREADY_EXISTS ao alterar código para um já usado', async () => {
        await createPlan.exec({ code: 'CODIGO_A', name: 'Plano A', amountCents: 1000, currency: 'BRL' });
        const planB = await createPlan.exec({ code: 'CODIGO_B', name: 'Plano B', amountCents: 2000, currency: 'BRL' });

        await expect(
            updatePlan.exec({
                planId: planB.id,
                code: 'CODIGO_A'
            })
        ).rejects.toMatchObject({ code: ErrorCode.ALREADY_EXISTS });
    });

    it('listagem retorna planos ativos e inativos ordenados por amountCents', async () => {
        await createPlan.exec({ code: 'Z_ALTO', name: 'Alto', amountCents: 50000, currency: 'BRL', isActive: false });
        await createPlan.exec({ code: 'Z_BAIXO', name: 'Baixo', amountCents: 5000, currency: 'BRL', isActive: true });

        const list = await listPlans.exec();
        const amounts = list.plans.map((p) => p.amountCents);

        expect(amounts).toEqual([...amounts].sort((a, b) => a - b));
        expect(list.plans.some((p) => p.code === 'Z_BAIXO' && p.isActive)).toBe(true);
        expect(list.plans.some((p) => p.code === 'Z_ALTO' && !p.isActive)).toBe(true);
    });
});
