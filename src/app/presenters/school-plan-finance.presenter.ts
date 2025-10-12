import { SchoolPlanFinance } from '../../domain/entities/school-plan-finance';

export type SchoolPlanFinanceView = {
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

export function presentSchoolPlanFinance(finance: SchoolPlanFinance): SchoolPlanFinanceView {
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
