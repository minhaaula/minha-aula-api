import { SchoolPlanFinanceRepository } from '../../ports/repositories/school-plan-finance.repo';
import { SubscriptionPlanRepository } from '../../ports/repositories/subscription-plan.repo';
import { SchoolRepository } from '../../ports/repositories/school.repo';
import { SchoolPlanFinance } from '../../domain/entities/school-plan-finance';
import { Uuid } from '../../shared/uuid';

type AssignSchoolPlanInput = {
    schoolId: string;
    planId: string;
    notes?: string | null;
};

type AssignSchoolPlanOutput = {
    schoolId: string;
    plan: {
        id: string;
        code: string;
        name: string;
        description: string | null;
        amountCents: number;
        currency: string;
        billingCycle: 'MONTHLY' | 'ANNUAL';
        isActive: boolean;
    };
    status: 'TRIAL' | 'ACTIVE' | 'PAST_DUE' | 'SUSPENDED' | 'CANCELLED';
    isPaid: boolean;
    lastPaymentAt: Date | null;
    nextDueAt: Date | null;
    notes: string | null;
    createdAt: Date;
    updatedAt: Date;
};

export class AssignSchoolPlan {
    constructor(
        private readonly schools: SchoolRepository,
        private readonly plans: SubscriptionPlanRepository,
        private readonly finances: SchoolPlanFinanceRepository
    ) {}

    async exec(input: AssignSchoolPlanInput): Promise<AssignSchoolPlanOutput> {
        const schoolId = input.schoolId.trim();
        const planId = input.planId.trim();
        if (!schoolId) throw new Error('School id is required');
        if (!planId) throw new Error('Plan id is required');

        const school = await this.schools.findById(schoolId);
        if (!school) throw new Error('School not found');

        const plan = await this.plans.findById(planId);
        if (!plan || !plan.isActive) throw new Error('Subscription plan not available');

        const current = await this.finances.findActiveBySchoolId(schoolId);
        const createdAt = current?.createdAt ?? new Date();
        const finance = SchoolPlanFinance.create({
            id: current?.id ?? Uuid(),
            schoolId,
            plan,
            status: 'ACTIVE',
            isPaid: false,
            lastPaymentAt: null,
            nextDueAt: this.calculateNextDue(plan.billingCycle),
            notes: input.notes ?? null,
            createdAt,
            updatedAt: new Date()
        });

        await this.finances.save(finance);

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

    private calculateNextDue(billingCycle: 'MONTHLY' | 'ANNUAL'): Date {
        const now = new Date();
        const due = new Date(now);
        if (billingCycle === 'ANNUAL') {
            due.setFullYear(due.getFullYear() + 1);
        } else {
            due.setMonth(due.getMonth() + 1);
        }
        return due;
    }
}
