import { AppDataSource } from './datasource';
import { SchoolPlanFinanceRepository } from '../../../ports/repositories/school-plan-finance.repo';
import { SchoolPlanFinanceOrm } from './entities/school-plan-finance.orm';
import { SchoolPlanFinance } from '../../../domain/entities/school-plan-finance';
import { SubscriptionPlan } from '../../../domain/entities/subscription-plan';
import { SubscriptionPlanOrm } from './entities/subscription-plan.orm';

export class SchoolPlanFinanceRepositoryAdapter implements SchoolPlanFinanceRepository {
    private readonly repo = AppDataSource.getRepository(SchoolPlanFinanceOrm);
    private readonly planRepo = AppDataSource.getRepository(SubscriptionPlanOrm);

    async findById(id: string): Promise<SchoolPlanFinance | null> {
        const normalized = id.trim();
        if (!normalized) return null;

        const row = await this.repo.findOne({
            where: { id: normalized },
            relations: {
                plan: true
            }
        });

        return row ? this.toDomain(row) : null;
    }

    async findActiveBySchoolId(schoolId: string): Promise<SchoolPlanFinance | null> {
        const normalized = schoolId.trim();
        if (!normalized) return null;

        const row = await this.repo.findOne({
            where: { schoolId: normalized },
            relations: {
                plan: true
            }
        });

        if (!row) return null;

        return this.toDomain(row);
    }

    async save(finance: SchoolPlanFinance): Promise<void> {
        const row = await this.toOrm(finance);
        await this.repo.save(row);
    }

    private toDomain(row: SchoolPlanFinanceOrm): SchoolPlanFinance {
        const plan = this.toPlanDomain(row.plan);
        return SchoolPlanFinance.create({
            id: row.id,
            schoolId: row.schoolId,
            plan,
            status: row.status,
            isPaid: Boolean(row.isPaid),
            lastPaymentAt: row.lastPaymentAt,
            nextDueAt: row.nextDueAt,
            notes: row.notes,
            createdAt: row.createdAt,
            updatedAt: row.updatedAt
        });
    }

    private toPlanDomain(row: SubscriptionPlanOrm): SubscriptionPlan {
        return SubscriptionPlan.create({
            id: row.id,
            code: row.code,
            name: row.name,
            description: row.description,
            amountCents: row.amountCents,
            currency: row.currency,
            billingCycle: row.billingCycle,
            isActive: row.isActive === 1,
            createdAt: row.createdAt,
            updatedAt: row.updatedAt
        });
    }

    private async toOrm(finance: SchoolPlanFinance): Promise<SchoolPlanFinanceOrm> {
        const existing = await this.repo.findOne({ where: { id: finance.id } });
        const row = existing ?? new SchoolPlanFinanceOrm();
        row.id = finance.id;
        row.schoolId = finance.schoolId;
        row.planId = finance.plan.id;
        row.status = finance.status;
        row.isPaid = finance.isPaid ? 1 : 0;
        row.lastPaymentAt = finance.lastPaymentAt;
        row.nextDueAt = finance.nextDueAt;
        row.notes = finance.notes;
        if (!existing) {
            row.createdAt = finance.createdAt;
        }
        row.updatedAt = finance.updatedAt;

        const plan = await this.planRepo.findOne({ where: { id: finance.plan.id } });
        if (plan) {
            row.plan = plan;
        }

        return row;
    }
}
