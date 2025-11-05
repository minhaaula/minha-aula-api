import { SchoolFinancialChargeRepository } from '../../ports/repositories/school-financial-charge.repo';
import { UserRepository } from '../../ports/repositories/user.repo';
import { PaymentProviderPort } from '../../ports/providers/payment-provider.port';
import { Money } from '../../domain/value-objects/money';
import { SchoolFinancialChargeStatus } from '../../domain/entities/school-financial-charge';
import { UserPersonaEnum } from '../../domain/value-objects/user-persona';
import type { IssueEnrollmentFeeBoletoInput, IssueEnrollmentFeeBoletoOutput } from '../types/enrollment.types';

export type IssueEnrollmentFeeBoletoResult = IssueEnrollmentFeeBoletoOutput;

export class IssueEnrollmentFeeBoleto {
    private readonly allowedStatuses = new Set<SchoolFinancialChargeStatus>(['PENDING_SYNC', 'FAILED', 'OPEN', 'PAID', 'OVERDUE']);

    constructor(
        private readonly charges: SchoolFinancialChargeRepository,
        private readonly users: UserRepository,
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

        const boleto = await this.paymentProvider.createBoletoCharge({
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
}
