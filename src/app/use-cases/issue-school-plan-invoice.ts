import { Money } from '../../domain/value-objects/money';
import { SchoolRepository } from '../../ports/repositories/school.repo';
import { SchoolPlanFinanceRepository } from '../../ports/repositories/school-plan-finance.repo';
import { SchoolPlanInvoiceRepository } from '../../ports/repositories/school-plan-invoice.repo';
import { DiscountCouponRepository } from '../../ports/repositories/discount-coupon.repo';
import { PaymentProviderPort } from '../../ports/providers/payment-provider.port';
import { SchoolPlanInvoice } from '../../domain/entities/school-plan-invoice';
import { SchoolPlanFinance } from '../../domain/entities/school-plan-finance';
import { calculateNextBillingDate } from '../utils/billing-cycle';
import { presentSchoolPlanInvoice, SchoolPlanInvoiceView } from '../presenters/school-plan-invoice.presenter';
import { presentSchoolPlanFinance, SchoolPlanFinanceView } from '../presenters/school-plan-finance.presenter';
import { Uuid } from '../../shared/uuid';
import { AppError, ErrorCode } from '../../shared/errors';

type IssueSchoolPlanInvoiceInput = {
    schoolId: string;
    dueDate?: Date;
    description?: string | null;
    couponCode?: string | null;
    generatePix?: boolean; // Se true, gera PIX ao invés de boleto
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
        private readonly paymentProvider: PaymentProviderPort,
        private readonly coupons?: DiscountCouponRepository
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

        const toUtcDateOnly = (d: Date) =>
            new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));

        const today = toUtcDateOnly(new Date());
        
        // Se generatePix é true (plano sendo selecionado), vencimento é hoje
        // Caso contrário, usa a lógica normal
        let dueDate: Date;
        if (input.generatePix === true) {
            dueDate = new Date(today);
        } else {
            const baseDue = input.dueDate ?? finance.nextDueAt ?? calculateNextBillingDate(plan.billingCycle);
            dueDate = toUtcDateOnly(new Date(baseDue));
            
            if (dueDate <= today) {
                const tomorrow = new Date(today);
                tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
                dueDate = tomorrow;
            }
        }

        let coupon = null;
        if (input.couponCode && this.coupons) {
            const couponCode = input.couponCode.trim().toUpperCase();
            const foundCoupon = await this.coupons.findByCode(couponCode);
            if (foundCoupon && foundCoupon.isValid()) {
                coupon = foundCoupon;
            }
        }

        const existingInvoice = await this.invoices.findByFinanceIdAndDueDate(finance.id, dueDate);
        if (existingInvoice) {
            return {
                finance,
                invoice: existingInvoice,
                alreadyExists: true
            };
        }

        const usePix = input.generatePix === true;
        
        if (usePix) {
            if (!this.paymentProvider.createPixCharge) {
                throw new Error('Configured payment provider does not support PIX invoices');
            }
        } else {
            if (!this.paymentProvider.createBoletoCharge) {
                throw new Error('Configured payment provider does not support boleto invoices');
            }
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

        const originalAmountCents = plan.amountCents;
        let amountCents = originalAmountCents;
        let discountAmountCents = 0;
        let discountPercentage: number | null = null;
        let discountCouponId: string | null = null;

        if (coupon) {
            discountPercentage = coupon.percentage;
            discountAmountCents = coupon.calculateDiscount(originalAmountCents);
            amountCents = coupon.calculateDiscountedAmount(originalAmountCents);
            discountCouponId = coupon.id;
        }

        let charge: { providerRef: string; boletoUrl?: string | null; digitableLine?: string | null; barcode?: string | null; pixQrCode?: string | null; pixCopiaECola?: string | null; invoiceUrl?: string | null; dueDate: Date };
        
        if (usePix) {
            const pixCharge = await this.paymentProvider.createPixCharge!({
                amount: Money.of(amountCents, plan.currency),
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
                description: input.description ?? `Assinatura ${plan.name}${coupon ? ` - Cupom ${coupon.code}` : ''}`,
                externalReference: `${finance.id}:${dueDate.toISOString().slice(0, 10)}`,
                metadata
            });
            
            charge = {
                providerRef: pixCharge.providerRef,
                pixQrCode: pixCharge.pixQrCode ?? null,
                pixCopiaECola: pixCharge.pixCopiaECola ?? null,
                invoiceUrl: pixCharge.invoiceUrl ?? null,
                dueDate: pixCharge.dueDate
            };
        } else {
            const boletoCharge = await this.paymentProvider.createBoletoCharge!({
                amount: Money.of(amountCents, plan.currency),
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
                description: input.description ?? `Assinatura ${plan.name}${coupon ? ` - Cupom ${coupon.code}` : ''}`,
                externalReference: `${finance.id}:${dueDate.toISOString().slice(0, 10)}`,
                metadata
            });
            
            charge = {
                providerRef: boletoCharge.providerRef,
                boletoUrl: boletoCharge.boletoUrl ?? null,
                digitableLine: boletoCharge.digitableLine ?? null,
                barcode: boletoCharge.barcode ?? null,
                dueDate: boletoCharge.dueDate
            };
        }

        const invoice = SchoolPlanInvoice.create({
            id: Uuid(),
            financeId: finance.id,
            schoolId,
            planId: plan.id,
            amountCents,
            currency: plan.currency,
            dueDate: charge.dueDate,
            description: input.description ?? `Assinatura ${plan.name}${coupon ? ` - Cupom ${coupon.code}` : ''}`,
            providerRef: charge.providerRef,
            boletoUrl: 'boletoUrl' in charge ? charge.boletoUrl ?? null : null,
            digitableLine: 'digitableLine' in charge ? charge.digitableLine ?? null : null,
            barcode: 'barcode' in charge ? charge.barcode ?? null : null,
            pixQrCode: 'pixQrCode' in charge ? charge.pixQrCode ?? null : null,
            pixCopiaECola: 'pixCopiaECola' in charge ? charge.pixCopiaECola ?? null : null,
            externalReference: `${finance.id}:${charge.dueDate.toISOString().slice(0, 10)}`,
            metadata,
            paidAt: null,
            discountCouponId,
            discountPercentage,
            discountAmountCents,
            originalAmountCents
        });

        await this.invoices.save(invoice);

        const invoices: SchoolPlanInvoice[] = [invoice];
        if (coupon && coupon.durationMonths > 1) {
            let currentDueDate = new Date(charge.dueDate);
            for (let month = 1; month < coupon.durationMonths; month++) {
                currentDueDate = calculateNextBillingDate(plan.billingCycle, currentDueDate);
                currentDueDate.setHours(0, 0, 0, 0);
                
                if (currentDueDate <= today) {
                    currentDueDate = new Date(today);
                    currentDueDate.setDate(currentDueDate.getDate() + 1);
                }
                
                const existing = await this.invoices.findByFinanceIdAndDueDate(finance.id, currentDueDate);
                if (existing) {
                    continue;
                }

                if (currentDueDate > coupon.validUntil) {
                    break;
                }

                if (!this.paymentProvider.createBoletoCharge) {
                    throw new Error('Cannot create additional invoices: boleto provider not available');
                }

                const additionalCharge = await this.paymentProvider.createBoletoCharge({
                    amount: Money.of(amountCents, plan.currency),
                    customer: {
                        name: customerName,
                        email: customerEmail,
                        cpfCnpj: customerTaxId,
                        postalCode: address.zipCode,
                        addressNumber: address.number,
                        addressComplement: address.complement ?? undefined,
                        phone: school.phone
                    },
                    dueDate: currentDueDate,
                    description: `Assinatura ${plan.name} - Cupom ${coupon.code} (${month + 1}/${coupon.durationMonths})`,
                    externalReference: `${finance.id}:${currentDueDate.toISOString().slice(0, 10)}`,
                    metadata
                });

                const additionalInvoice = SchoolPlanInvoice.create({
                    id: Uuid(),
                    financeId: finance.id,
                    schoolId,
                    planId: plan.id,
                    amountCents,
                    currency: plan.currency,
                    dueDate: additionalCharge.dueDate,
                    description: `Assinatura ${plan.name} - Cupom ${coupon.code} (${month + 1}/${coupon.durationMonths})`,
                    providerRef: additionalCharge.providerRef,
                    boletoUrl: additionalCharge.boletoUrl ?? null,
                    digitableLine: additionalCharge.digitableLine ?? null,
                    barcode: additionalCharge.barcode ?? null,
                    externalReference: `${finance.id}:${additionalCharge.dueDate.toISOString().slice(0, 10)}`,
                    metadata,
                    paidAt: null,
                    discountCouponId,
                    discountPercentage,
                    discountAmountCents,
                    originalAmountCents
                });

                await this.invoices.save(additionalInvoice);
                invoices.push(additionalInvoice);
            }
        }

        const lastInvoiceDate = invoices[invoices.length - 1].dueDate;
        const nextDueAt = calculateNextBillingDate(plan.billingCycle, lastInvoiceDate);
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
            invoice: invoices[0],
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
