import { SchoolFinancialChargeRepository } from '../../ports/repositories/school-financial-charge.repo';
import { UserRepository } from '../../ports/repositories/user.repo';
import { SchoolRepository } from '../../ports/repositories/school.repo';
import { PaymentProviderPort } from '../../ports/providers/payment-provider.port';
import { AsaasProvider } from '../../infra/providers/asaas/asaas-provider';
import { Money } from '../../domain/value-objects/money';
import { SchoolFinancialChargeStatus } from '../../domain/entities/school-financial-charge';
import { UserPersonaEnum } from '../../domain/value-objects/user-persona';
import type { IssueEnrollmentFeeBoletoInput, IssueEnrollmentFeeBoletoOutput } from '../types/enrollment.types';

export type IssueEnrollmentFeeBoletoResult = IssueEnrollmentFeeBoletoOutput;

export class IssueEnrollmentFeeBoleto {
    private readonly allowedStatuses = new Set<SchoolFinancialChargeStatus>(['PENDING_SYNC', 'FAILED', 'OPEN', 'PAID', 'OVERDUE']);
    // Tipos de cobrança que devem usar a conta Asaas da escola (mensalidades e cobranças dos alunos)
    private readonly studentChargeTypes = new Set(['ENROLLMENT', 'TUITION']);

    constructor(
        private readonly charges: SchoolFinancialChargeRepository,
        private readonly users: UserRepository,
        private readonly schools: SchoolRepository,
        private readonly paymentProvider: PaymentProviderPort
    ) {}

    async exec(params: IssueEnrollmentFeeBoletoInput): Promise<IssueEnrollmentFeeBoletoOutput> {
        if (!this.paymentProvider.createBoletoCharge) {
            throw new Error('Configured payment provider does not support boleto issuance');
        }

        const charge = await this.charges.findById(params.chargeId);
        if (!charge) {
            throw new Error('Charge not found');
        }

        if (charge.chargeType !== 'ENROLLMENT') {
            throw new Error('Charge type does not allow boleto issuance');
        }

        if (!this.allowedStatuses.has(charge.status)) {
            throw new Error('Charge is not eligible for boleto issuance');
        }

        this.ensureRequesterCanIssue(params.requester, charge.schoolId, charge.ownerUserId);

        if (charge.asaasPaymentId) {
            return this.serializeExistingCharge(charge);
        }

        const owner = await this.users.findById(charge.ownerUserId);
        if (!owner) {
            throw new Error('Owner user not found');
        }

        const address = owner.address.toPrimitives();
        const amount = Money.of(charge.netAmountCents, 'BRL');

        // Para mensalidades e cobranças dos alunos, usar a conta Asaas da escola se disponível
        const provider = await this.resolvePaymentProvider(charge);

        if (!provider.createBoletoCharge) {
            throw new Error('Payment provider does not support boleto issuance');
        }

        const boleto = await provider.createBoletoCharge({
            amount,
            dueDate: charge.dueDate,
            description: charge.description ?? 'Taxa de matrícula',
            externalReference: charge.id,
            customer: {
                name: owner.fullName,
                email: owner.email.value,
                cpfCnpj: owner.cpf,
                postalCode: address.zipCode,
                addressNumber: address.number,
                addressComplement: address.complement ?? undefined,
                phone: owner.phone
            },
            metadata: this.buildMetadata(charge)
        });

        charge.markAsSynced({
            paymentId: boleto.providerRef,
            invoiceUrl: boleto.boletoUrl ?? null,
            payload: {
                digitableLine: boleto.digitableLine ?? null,
                barcode: boleto.barcode ?? null,
                dueDate: boleto.dueDate.toISOString()
            }
        });

        await this.charges.save(charge);

        return {
            chargeId: charge.id,
            paymentProviderRef: charge.asaasPaymentId!,
            boletoUrl: charge.asaasInvoiceUrl,
            digitableLine: this.resolveDigitableLine(charge),
            barcode: this.resolveBarcode(charge),
            dueDate: boleto.dueDate,
            status: charge.status
        };
    }

    private ensureRequesterCanIssue(requester: IssueEnrollmentFeeBoletoInput['requester'], schoolId: string, ownerUserId: string) {
        switch (requester.persona) {
            case UserPersonaEnum.STUDENT:
                if (ownerUserId !== requester.id) {
                    throw new Error('User not allowed to issue boleto for this charge');
                }
                break;
            case UserPersonaEnum.SCHOOL:
                if (!requester.schoolId || requester.schoolId !== schoolId) {
                    throw new Error('User not allowed to issue boleto for this charge');
                }
                break;
            case UserPersonaEnum.ADMIN:
                break;
            default:
                throw new Error('User not allowed to issue boleto for this charge');
        }
    }

    private buildMetadata(charge: { id: string; schoolId: string; ownerUserId: string; dependentId: string | null; courseId: string; courseClassId: string | null; }): Record<string, string> {
        const metadata: Record<string, string> = {
            chargeId: charge.id,
            schoolId: charge.schoolId,
            ownerUserId: charge.ownerUserId,
            courseId: charge.courseId
        };
        if (charge.courseClassId) {
            metadata.courseClassId = charge.courseClassId;
        }
        if (charge.dependentId) {
            metadata.dependentId = charge.dependentId;
        }
        metadata.type = 'ENROLLMENT_FEE';
        return metadata;
    }

    private serializeExistingCharge(charge: import('../../domain/entities/school-financial-charge').SchoolFinancialCharge): IssueEnrollmentFeeBoletoOutput {
        const payload = charge.asaasPayload ?? {};
        const dueDateValue = typeof payload?.dueDate === 'string' ? new Date(payload.dueDate) : charge.dueDate;
        return {
            chargeId: charge.id,
            paymentProviderRef: charge.asaasPaymentId!,
            boletoUrl: charge.asaasInvoiceUrl,
            digitableLine: this.resolveDigitableLine(charge),
            barcode: this.resolveBarcode(charge),
            dueDate: dueDateValue,
            status: charge.status
        };
    }

    private resolveDigitableLine(charge: import('../../domain/entities/school-financial-charge').SchoolFinancialCharge): string | null {
        const payload = charge.asaasPayload ?? {};
        const value = (payload as Record<string, unknown>).digitableLine;
        return typeof value === 'string' && value.trim().length > 0 ? value : null;
    }

    private resolveBarcode(charge: import('../../domain/entities/school-financial-charge').SchoolFinancialCharge): string | null {
        const payload = charge.asaasPayload ?? {};
        const value = (payload as Record<string, unknown>).barcode;
        return typeof value === 'string' && value.trim().length > 0 ? value : null;
    }

    /**
     * Resolve o provider de pagamento a ser usado.
     * Para mensalidades e cobranças dos alunos (ENROLLMENT, TUITION), usa a conta Asaas da escola se disponível.
     * Caso contrário, usa o provider principal.
     */
    private async resolvePaymentProvider(charge: import('../../domain/entities/school-financial-charge').SchoolFinancialCharge): Promise<PaymentProviderPort> {
        // Apenas para mensalidades e cobranças dos alunos
        if (!this.studentChargeTypes.has(charge.chargeType)) {
            return this.paymentProvider;
        }

        // Buscar escola para verificar se tem conta Asaas
        const school = await this.schools.findById(charge.schoolId);
        if (!school || !school.accountId) {
            // Se não tiver conta Asaas, usar provider principal
            return this.paymentProvider;
        }

        // Verificar se tem API key da subconta
        const accountApiKey = school.accountApiKey;
        if (!accountApiKey || !accountApiKey.trim()) {
            // Se não tiver API key, usar provider principal
            return this.paymentProvider;
        }

        // Criar provider com a API key da subconta da escola
        const baseUrl = process.env.ASAAS_BASE_URL || 'https://www.asaas.com/api/v3';
        return new AsaasProvider({ apiKey: accountApiKey.trim(), baseUrl });
    }
}
