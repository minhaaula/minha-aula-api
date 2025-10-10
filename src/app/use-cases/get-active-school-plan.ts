import { SchoolPlanFinanceRepository } from '../../ports/repositories/school-plan-finance.repo';
import { SchoolPlanStatus } from '../../domain/entities/school-plan-finance';
import { SubscriptionBillingCycle } from '../../domain/entities/subscription-plan';

type GetActiveSchoolPlanOutput = {
    schoolId: string;
    plan: {
        id: string;
        code: string;
        name: string;
        description: string | null;
        amountCents: number;
        currency: string;
        billingCycle: SubscriptionBillingCycle;
        isActive: boolean;
    };
    status: SchoolPlanStatus;
    isPaid: boolean;
    lastPaymentAt: Date | null;
    nextDueAt: Date | null;
    notes: string | null;
    createdAt: Date;
    updatedAt: Date;
};

export class GetActiveSchoolPlan {
    constructor(private readonly finances: SchoolPlanFinanceRepository) {}

    async exec(input: { schoolId: string }): Promise<GetActiveSchoolPlanOutput | null> {
        const finance = await this.finances.findActiveBySchoolId(input.schoolId);
        if (!finance) return null;

        const plan = finance.plan;

        return {
            schoolId: finance.schoolId,
            plan: {
                id: plan.id,
                code: plan.code,
                name: plan.name,
                description: plan.description,
                amountCents: plan.amountCents,
                currency: plan.currency,
                billingCycle: plan.billingCycle,
                isActive: plan.isActive
            },
            status: finance.status,
            isPaid: finance.isPaid,
            lastPaymentAt: finance.lastPaymentAt,
            nextDueAt: finance.nextDueAt,
            notes: finance.notes,
            createdAt: finance.createdAt,
            updatedAt: finance.updatedAt
        };
    }
}

