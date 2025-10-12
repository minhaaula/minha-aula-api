import { Money } from '../../domain/value-objects/money';
import { SchoolRepository } from '../../ports/repositories/school.repo';
import { SchoolPlanFinanceRepository } from '../../ports/repositories/school-plan-finance.repo';
import { SchoolPlanInvoiceRepository } from '../../ports/repositories/school-plan-invoice.repo';
import { PaymentProviderPort } from '../../ports/providers/payment-provider.port';
import { SchoolPlanInvoice } from '../../domain/entities/school-plan-invoice';
import { SchoolPlanFinance } from '../../domain/entities/school-plan-finance';
import { calculateNextBillingDate } from '../utils/billing-cycle';
import { presentSchoolPlanInvoice, SchoolPlanInvoiceView } from '../presenters/school-plan-invoice.presenter';
import { presentSchoolPlanFinance, SchoolPlanFinanceView } from '../presenters/school-plan-finance.presenter';
import { Uuid } from '../../shared/uuid';

type IssueSchoolPlanInvoiceInput = {
    schoolId: string;
    dueDate?: Date;
    description?: string | null;
};

export type IssueSchoolPlanInvoiceResult = {
    finance: SchoolPlanFinance;
    invoice: SchoolPlanInvoice;
    alreadyExists: boolean;
};

export type IssueSchoolPlanInvoiceView = {
    finance: SchoolPlanFinanceView;
    invoice: SchoolPlanInvoiceView;
    alreadyExists: boolean;
};

export class IssueSchoolPlanInvoice {
    constructor(
        private readonly schools: SchoolRepository,
        private readonly finances: SchoolPlanFinanceRepository,
        private readonly invoices: SchoolPlanInvoiceRepository,
        private readonly paymentProvider: PaymentProviderPort
    ) {}

    async exec(input: IssueSchoolPlanInvoiceInput): Promise<IssueSchoolPlanInvoiceResult> {
        const schoolId = input.schoolId.trim();
        if (!schoolId) throw new Error('School id is required');

        const school = await this.schools.findById(schoolId);
        if (!school) throw new Error('School not found');

        const finance = await this.finances.findActiveBySchoolId(schoolId);
        if (!finance) {
            throw new Error('School does not have an active subscription plan');
        }

        const plan = finance.plan;
        const baseDue = input.dueDate ?? finance.nextDueAt ?? calculateNextBillingDate(plan.billingCycle);
        const dueDate = new Date(baseDue);

        const existingInvoice = await this.invoices.findByFinanceIdAndDueDate(finance.id, dueDate);
        if (existingInvoice) {
            return {
                finance,
                invoice: existingInvoice,
                alreadyExists: true
            };
        }

        if (!this.paymentProvider.createBoletoCharge) {
            throw new Error('Configured payment provider does not support boleto invoices');
        }

        const address = school.addresses[0]?.toPrimitives();
        if (!address) {
            throw new Error('School must have at least one address to issue invoices');
        }

        const customerName = school.ownerName ?? school.name;
        const customerEmail = school.ownerEmail ?? school.email;
        const customerTaxId = school.ownerCpf ?? school.cnpj;
        const metadata = {
            schoolId,
            planId: plan.id,
            financeId: finance.id
        };

        const charge = await this.paymentProvider.createBoletoCharge({
            amount: Money.of(plan.amountCents, plan.currency),
            customer: {
                name: customerName,
                email: customerEmail,
                cpfCnpj: customerTaxId,
                postalCode: address.zipCode,
                addressNumber: address.number,
                addressComplement: address.complement ?? undefined,
                phone: school.phone
            },
            dueDate,
            description: input.description ?? `Assinatura ${plan.name}`,
            externalReference: `${finance.id}:${dueDate.toISOString().slice(0, 10)}`,
            metadata
        });

        const invoice = SchoolPlanInvoice.create({
            id: Uuid(),
            financeId: finance.id,
            schoolId,
            planId: plan.id,
            amountCents: plan.amountCents,
            currency: plan.currency,
            dueDate: charge.dueDate,
            description: input.description ?? `Assinatura ${plan.name}`,
            providerRef: charge.providerRef,
            boletoUrl: charge.boletoUrl ?? null,
            digitableLine: charge.digitableLine ?? null,
            barcode: charge.barcode ?? null,
            externalReference: `${finance.id}:${charge.dueDate.toISOString().slice(0, 10)}`,
            metadata,
            paidAt: null
        });

        await this.invoices.save(invoice);

        const nextDueAt = calculateNextBillingDate(plan.billingCycle, charge.dueDate);
        const updatedFinance = SchoolPlanFinance.create({
            id: finance.id,
            schoolId: finance.schoolId,
            plan,
            status: finance.status,
            isPaid: false,
            lastPaymentAt: finance.lastPaymentAt,
            nextDueAt,
            notes: finance.notes,
            createdAt: finance.createdAt,
            updatedAt: new Date()
        });

        await this.finances.save(updatedFinance);

        return {
            finance: updatedFinance,
            invoice,
            alreadyExists: false
        };
    }

    async execView(input: IssueSchoolPlanInvoiceInput): Promise<IssueSchoolPlanInvoiceView> {
        const result = await this.exec(input);
        return {
            finance: presentSchoolPlanFinance(result.finance),
            invoice: presentSchoolPlanInvoice(result.invoice),
            alreadyExists: result.alreadyExists
        };
    }
}
