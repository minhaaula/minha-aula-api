import { SchoolFinancialChargeRepository } from '../../../ports/repositories/school-financial-charge.repo';
import { SchoolRepository } from '../../../ports/repositories/school.repo';
import type { PaymentProviderPort } from '../../../ports/providers/payment-provider.port';
import type { AsaasProviderPort } from '../../../ports/providers/asaas-port';
import {
    SchoolFinancialCharge,
    SchoolFinancialChargePaymentMethod,
    SchoolFinancialChargeStatus
} from '../../../domain/entities/school-financial-charge';
import { AppError, ErrorCode } from '../../../shared/errors';
import { log } from '../../../shared/logger';

const SUCCESS_STATUSES = new Set(['RECEIVED', 'RECEIVED_IN_CASH', 'CONFIRMED']);
const OVERDUE_STATUSES = new Set(['OVERDUE']);
const CANCELLED_STATUSES = new Set(['CANCELLED', 'REFUNDED', 'CHARGEBACK']);

const CAN_MARK_PAID: ReadonlySet<SchoolFinancialChargeStatus> = new Set([
    'PENDING_SYNC',
    'OPEN',
    'OVERDUE',
    'FAILED'
]);

export interface VerifyStudentPaymentStatusInput {
    paymentId: string;
    userId: string;
}

export interface VerifyStudentPaymentStatusOutput {
    paymentId: string;
    status: SchoolFinancialChargeStatus;
    paidAt: Date | null;
    /** True quando a API consultou o Asaas nesta requisição e persistiu alteração de status. */
    syncedFromProvider: boolean;
}

export class VerifyStudentPaymentStatus {
    constructor(
        private readonly financialCharges: SchoolFinancialChargeRepository,
        private readonly schools: SchoolRepository,
        private readonly paymentProvider: PaymentProviderPort
    ) {}

    async exec(input: VerifyStudentPaymentStatusInput): Promise<VerifyStudentPaymentStatusOutput> {
        const paymentId = input.paymentId?.trim();
        const userId = input.userId?.trim();

        if (!paymentId) {
            throw AppError.fromCode(ErrorCode.INVALID_IDENTIFIERS, {
                message: 'ID do pagamento é obrigatório'
            });
        }

        if (!userId) {
            throw AppError.fromCode(ErrorCode.INVALID_IDENTIFIERS, {
                message: 'ID do usuário é obrigatório'
            });
        }

        let charge = await this.financialCharges.findById(paymentId);
        if (!charge) {
            throw AppError.fromCode(ErrorCode.CHARGE_NOT_FOUND, { paymentId });
        }

        if (charge.ownerUserId !== userId) {
            throw AppError.fromCode(ErrorCode.NOT_ALLOWED, {
                message: 'Pagamento não pertence ao usuário',
                paymentId,
                userId
            });
        }

        let syncedFromProvider = false;
        if (this.shouldSyncFromProvider(charge)) {
            const synced = await this.syncChargeFromAsaas(charge);
            if (synced) {
                charge = synced;
                syncedFromProvider = true;
            }
        }

        return {
            paymentId: charge.id,
            status: charge.status,
            paidAt: charge.paidAt,
            syncedFromProvider
        };
    }

    private shouldSyncFromProvider(charge: SchoolFinancialCharge): boolean {
        if (!charge.asaasPaymentId?.trim()) {
            return false;
        }
        if (charge.status === 'PAID' || charge.status === 'CANCELLED') {
            return false;
        }
        return true;
    }

    private async syncChargeFromAsaas(charge: SchoolFinancialCharge): Promise<SchoolFinancialCharge | null> {
        const provider = await this.resolveAsaasProvider(charge);
        const getPayment = (provider as Partial<AsaasProviderPort>).getPayment;
        if (!getPayment) {
            return null;
        }

        const asaasPaymentId = charge.asaasPaymentId!.trim();

        try {
            const payment = await getPayment.call(provider, asaasPaymentId);
            const targetStatus = this.resolveTargetStatus(payment.status);
            if (!targetStatus || targetStatus === charge.status) {
                return null;
            }

            if (targetStatus === 'PAID' && !CAN_MARK_PAID.has(charge.status)) {
                return null;
            }

            if (targetStatus === 'PAID' && charge.status === 'PAID') {
                return null;
            }

            const paidAt =
                targetStatus === 'PAID' ? this.resolvePaidAt(payment) : charge.paidAt;
            const paymentMethod: SchoolFinancialChargePaymentMethod | null =
                targetStatus === 'PAID' ? 'PIX' : charge.paymentMethod;

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
                providerNetAmountCents: charge.providerNetAmountCents,
                dueDate: charge.dueDate,
                status: targetStatus,
                asaasPaymentId: charge.asaasPaymentId,
                asaasInvoiceUrl: charge.asaasInvoiceUrl,
                asaasPayload: charge.asaasPayload,
                paidAt:
                    targetStatus === 'PAID'
                        ? paidAt ?? new Date()
                        : targetStatus === 'CANCELLED'
                          ? null
                          : charge.paidAt,
                paymentMethod: targetStatus === 'PAID' ? paymentMethod : charge.paymentMethod,
                paidObservation: charge.paidObservation,
                cancelledAt: targetStatus === 'CANCELLED' ? (charge.cancelledAt ?? new Date()) : charge.cancelledAt,
                createdAt: charge.createdAt,
                updatedAt: new Date()
            });

            await this.financialCharges.save(updated);
            return updated;
        } catch (error) {
            log.warn('[VerifyStudentPaymentStatus] Falha ao consultar pagamento no Asaas', {
                chargeId: charge.id,
                asaasPaymentId,
                error: error instanceof Error ? error.message : String(error)
            });
            return null;
        }
    }

    private resolveTargetStatus(asaasStatus: string | undefined): SchoolFinancialChargeStatus | null {
        const s = asaasStatus?.toUpperCase()?.trim() ?? '';
        if (!s) return null;
        if (SUCCESS_STATUSES.has(s)) return 'PAID';
        if (CANCELLED_STATUSES.has(s)) return 'CANCELLED';
        if (OVERDUE_STATUSES.has(s)) return 'OVERDUE';
        if (s === 'PENDING') return null;
        return null;
    }

    private resolvePaidAt(payment: {
        paymentDate?: string | null;
        confirmedDate?: string | null;
        receivedDate?: string | null;
    }): Date | null {
        for (const value of [payment.confirmedDate, payment.receivedDate, payment.paymentDate]) {
            if (!value) continue;
            const parsed = new Date(value);
            if (!Number.isNaN(parsed.getTime())) {
                return parsed;
            }
        }
        return new Date();
    }

    private async resolveAsaasProvider(
        charge: SchoolFinancialCharge
    ): Promise<PaymentProviderPort & Partial<AsaasProviderPort>> {
        const school = await this.schools.findById(charge.schoolId);
        const accountApiKey = school?.accountApiKey?.trim();
        if (!accountApiKey) {
            return this.paymentProvider as PaymentProviderPort & Partial<AsaasProviderPort>;
        }

        const { AsaasProviderFactory } = await import('../../../infra/providers/asaas/asaas-provider-factory.js');
        const subAccountProvider = AsaasProviderFactory.createSubAccountProvider(accountApiKey);
        if (!subAccountProvider) {
            return this.paymentProvider as PaymentProviderPort & Partial<AsaasProviderPort>;
        }

        return subAccountProvider as PaymentProviderPort & Partial<AsaasProviderPort>;
    }
}
