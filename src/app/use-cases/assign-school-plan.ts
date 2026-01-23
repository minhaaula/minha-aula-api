import { SchoolPlanFinanceRepository } from '../../ports/repositories/school-plan-finance.repo';
import { SubscriptionPlanRepository } from '../../ports/repositories/subscription-plan.repo';
import { SchoolRepository } from '../../ports/repositories/school.repo';
import { SchoolPlanFinance } from '../../domain/entities/school-plan-finance';
import { Uuid } from '../../shared/uuid';
import { toUtcDateOnly, getTodayUtc } from '../../shared/date-utils';
import { calculateNextBillingDate } from '../utils/billing-cycle';
import { presentSchoolPlanFinance, SchoolPlanFinanceView } from '../presenters/school-plan-finance.presenter';
import { IssueSchoolPlanInvoice } from './issue-school-plan-invoice';
import { presentSchoolPlanInvoice, SchoolPlanInvoiceView } from '../presenters/school-plan-invoice.presenter';

type AssignSchoolPlanInput = {
    schoolId: string;
    planId: string;
    notes?: string | null;
    couponCode?: string | null;
};

type AssignSchoolPlanOutput = SchoolPlanFinanceView & {
    invoice?: SchoolPlanInvoiceView;
    invoiceAlreadyExists?: boolean;
};

export class AssignSchoolPlan {
    constructor(
        private readonly schools: SchoolRepository,
        private readonly plans: SubscriptionPlanRepository,
        private readonly finances: SchoolPlanFinanceRepository,
        private readonly invoiceIssuer?: IssueSchoolPlanInvoice
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
        
        const today = getTodayUtc();
        
        let baseNextDueAt: Date;
        if (current?.nextDueAt) {
            const nextDue = toUtcDateOnly(new Date(current.nextDueAt));
            const tomorrow = toUtcDateOnly(addDays(new Date(), 1));
            baseNextDueAt = nextDue <= today ? tomorrow : nextDue;
        } else {
            baseNextDueAt = toUtcDateOnly(addDays(new Date(), 1));
        }
        
        const nextDueAt = this.invoiceIssuer
            ? baseNextDueAt
            : (current?.nextDueAt && new Date(current.nextDueAt) > today 
                ? current.nextDueAt 
                : calculateNextBillingDate(plan.billingCycle, baseNextDueAt));
        const finance = SchoolPlanFinance.create({
            id: current?.id ?? Uuid(),
            schoolId,
            plan,
            status: 'ACTIVE',
            isPaid: current?.isPaid ?? false,
            lastPaymentAt: current?.lastPaymentAt ?? null,
            nextDueAt,
            notes: input.notes ?? null,
            createdAt,
            updatedAt: new Date()
        });

        await this.finances.save(finance);

        let financeForOutput = finance;
        let invoiceView: SchoolPlanInvoiceView | undefined;
        let invoiceAlreadyExists: boolean | undefined;

        if (this.invoiceIssuer) {
            const issued = await this.invoiceIssuer.exec({
                schoolId,
                dueDate: finance.nextDueAt ?? undefined,
                couponCode: input.couponCode ?? null,
                generatePix: true // Gerar PIX quando plano é selecionado
            });
            financeForOutput = issued.finance;
            invoiceView = presentSchoolPlanInvoice(issued.invoice);
            invoiceAlreadyExists = issued.alreadyExists;
        }

        return {
            ...presentSchoolPlanFinance(financeForOutput),
            invoice: invoiceView,
            invoiceAlreadyExists
        };
    }
}

function addDays(date: Date, days: number): Date {
    const copy = new Date(date);
    copy.setDate(copy.getDate() + days);
    return copy;
}
