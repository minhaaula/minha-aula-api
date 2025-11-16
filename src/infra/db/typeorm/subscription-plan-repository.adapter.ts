import { AppDataSource } from './datasource';
import { SubscriptionPlanRepository } from '../../../ports/repositories/subscription-plan.repo';
import { SubscriptionPlan } from '../../../domain/entities/subscription-plan';
import { SubscriptionPlanOrm } from './entities/subscription-plan.orm';

export class SubscriptionPlanRepositoryAdapter implements SubscriptionPlanRepository {
    private readonly repo = AppDataSource.getRepository(SubscriptionPlanOrm);

    async findActive(): Promise<SubscriptionPlan[]> {
        const rows = await this.repo.find({
            where: { isActive: 1 },
            order: { amountCents: 'ASC' }
        });
        return rows.map((row) => this.toDomain(row));
    }

    async findById(id: string): Promise<SubscriptionPlan | null> {
        const normalized = id.trim();
        if (!normalized) return null;
        const row = await this.repo.findOne({ where: { id: normalized } });
        return row ? this.toDomain(row) : null;
    }

    private toDomain(row: SubscriptionPlanOrm): SubscriptionPlan {
        return SubscriptionPlan.create({
            id: row.id,
            code: row.code,
            name: row.name,
            description: row.description,
            items: row.items,
            amountCents: row.amountCents,
            currency: row.currency,
            billingCycle: row.billingCycle,
            isActive: row.isActive === 1,
            createdAt: row.createdAt,
            updatedAt: row.updatedAt
        });
    }
}


