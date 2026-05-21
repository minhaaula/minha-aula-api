import type { SchoolFinancialChargeRepository } from '../../../ports/repositories/school-financial-charge.repo';
import type { SchoolRepository } from '../../../ports/repositories/school.repo';
import type { AsaasProviderPort } from '../../../ports/providers/asaas-port';
import { SchoolFinancialCharge } from '../../../domain/entities/school-financial-charge';
import { AppError, ErrorCode } from '../../../shared/errors';
import { log } from '../../../shared/logger';

export interface AdminMarkChargePaidInput {
    chargeId: string;
    /** Data do pagamento; se não informada, usa a data/hora atual. */
    paidAt?: Date;
}

export interface AdminMarkChargePaidOutput {
    chargeId: string;
    status: string;
    paidAt: Date;
}

const ALLOWED_STATUSES_TO_MARK_PAID = new Set(['PENDING_SYNC', 'OPEN', 'OVERDUE', 'FAILED']);

export class AdminMarkChargePaid {
    constructor(
        private readonly chargeRepo: SchoolFinancialChargeRepository,
        private readonly schoolsRepo: SchoolRepository,
        private readonly asaasProvider?: AsaasProviderPort | null
    ) {}

    async exec(input: AdminMarkChargePaidInput): Promise<AdminMarkChargePaidOutput> {
        const chargeId = input.chargeId?.trim();
        if (!chargeId) {
            throw AppError.fromCode(ErrorCode.REQUIRED_FIELD, { field: 'chargeId' });
        }

        const charge = await this.chargeRepo.findById(chargeId);
        if (!charge) {
            throw AppError.notFound('Cobrança', { chargeId });
        }

        if (charge.status === 'PAID') {
            return {
                chargeId: charge.id,
                status: 'PAID',
                paidAt: charge.paidAt!
            };
        }

        if (charge.status === 'CANCELLED') {
            throw AppError.fromCode(ErrorCode.BUSINESS_RULE_VIOLATION, {
                reason: 'Não é possível dar baixa em cobrança cancelada'
            });
        }

        if (!ALLOWED_STATUSES_TO_MARK_PAID.has(charge.status)) {
            throw AppError.fromCode(ErrorCode.BUSINESS_RULE_VIOLATION, {
                reason: `Status atual (${charge.status}) não permite dar baixa manual`
            });
        }

        const paidAt = input.paidAt ? new Date(input.paidAt) : new Date();
        if (Number.isNaN(paidAt.getTime())) {
            throw AppError.fromCode(ErrorCode.INVALID_DATE, { field: 'paidAt' });
        }

        // Se tem PIX ou boleto no Asaas, marcar como recebido no Asaas (receiveInCash)
        if (charge.asaasPaymentId?.trim() && this.asaasProvider?.receivePaymentInCash) {
            await this.tryMarkAsaasPaymentReceived(charge, paidAt);
        }

        const updated = SchoolFinancialCharge.restore({
            id: charge.id,
            schoolId: charge.schoolId,
            ownerUserId: charge.ownerUserId,
            studentUserId: charge.studentUserId,
            dependentId: charge.dependentId,
            courseId: charge.courseId,
            courseClassId: charge.courseClassId,
            chargeType: charge.chargeType,
            description: charge.description,
            amountCents: charge.amountCents,
            discountCents: charge.discountCents,
            discountReason: charge.discountReason,
            netAmountCents: charge.netAmountCents,
            providerNetAmountCents: charge.providerNetAmountCents ?? null,
            dueDate: charge.dueDate,
            status: 'PAID',
            asaasPaymentId: charge.asaasPaymentId,
            asaasInvoiceUrl: charge.asaasInvoiceUrl,
            asaasPayload: charge.asaasPayload,
            paidAt,
            paymentMethod: 'MANUAL',
            paidObservation: charge.paidObservation,
            cancelledAt: charge.cancelledAt,
            createdAt: charge.createdAt,
            updatedAt: new Date()
        });
        await this.chargeRepo.save(updated);

        return {
            chargeId: updated.id,
            status: updated.status,
            paidAt: updated.paidAt!
        };
    }

    /**
     * Marca a cobrança como recebida no Asaas (receiveInCash), para o PIX/boleto constar como pago lá.
     * Em caso de falha, apenas registra log e segue com a baixa no nosso lado.
     */
    private async tryMarkAsaasPaymentReceived(charge: SchoolFinancialCharge, paidAt: Date): Promise<void> {
        try {
            const provider = await this.resolveAsaasProvider(charge);
            if (!provider?.receivePaymentInCash) return;
            const paymentDate = paidAt.toISOString().slice(0, 10);
            const valueReais = charge.netAmountCents / 100;
            await provider.receivePaymentInCash(charge.asaasPaymentId!, {
                paymentDate,
                value: valueReais,
                notifyCustomer: false
            });
            log.info('[AdminMarkChargePaid] Cobrança Asaas marcada como recebida ao dar baixa manual', {
                chargeId: charge.id,
                asaasPaymentId: charge.asaasPaymentId
            });
        } catch (err) {
            log.warn('[AdminMarkChargePaid] Falha ao marcar cobrança como recebida no Asaas (baixa manual segue no nosso lado)', {
                chargeId: charge.id,
                asaasPaymentId: charge.asaasPaymentId,
                error: err instanceof Error ? err.message : String(err)
            });
        }
    }

    private async resolveAsaasProvider(charge: SchoolFinancialCharge): Promise<AsaasProviderPort | null> {
        if (!this.asaasProvider) return null;
        const school = await this.schoolsRepo.findById(charge.schoolId);
        if (!school?.accountApiKey?.trim()) {
            return this.asaasProvider;
        }
        const { AsaasProviderFactory } = await import('../../../infra/providers/asaas/asaas-provider-factory.js');
        const sub = AsaasProviderFactory.createSubAccountProvider(school.accountApiKey);
        return (sub as AsaasProviderPort) ?? this.asaasProvider;
    }
}
