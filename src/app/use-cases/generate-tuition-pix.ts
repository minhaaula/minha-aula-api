import { SchoolFinancialChargeRepository } from '../../ports/repositories/school-financial-charge.repo';
import { UserRepository } from '../../ports/repositories/user.repo';
import { SchoolRepository } from '../../ports/repositories/school.repo';
import { CourseRepository } from '../../ports/repositories/course.repo';
import { PaymentProviderPort } from '../../ports/providers/payment-provider.port';
import { AsaasProvider } from '../../infra/providers/asaas/asaas-provider';
import { Money } from '../../domain/value-objects/money';
import { SchoolFinancialChargeStatus } from '../../domain/entities/school-financial-charge';
import { UserPersonaEnum } from '../../domain/value-objects/user-persona';

export interface GenerateTuitionPixInput {
    chargeId: string;
    requester: {
        id: string;
        persona: UserPersonaEnum;
        schoolId?: string;
    };
}

export interface GenerateTuitionPixOutput {
    chargeId: string;
    paymentProviderRef: string;
    pixQrCode?: string | null;
    pixCopiaECola?: string | null;
    invoiceUrl?: string | null;
    dueDate: Date;
    status: SchoolFinancialChargeStatus;
    amountCents: number;
    courseName: string;
}

export class GenerateTuitionPix {
    private readonly allowedStatuses = new Set<SchoolFinancialChargeStatus>(['PENDING_SYNC', 'FAILED', 'OPEN', 'OVERDUE']);
    private readonly studentChargeTypes = new Set(['TUITION']);

    constructor(
        private readonly charges: SchoolFinancialChargeRepository,
        private readonly users: UserRepository,
        private readonly schools: SchoolRepository,
        private readonly courses: CourseRepository,
        private readonly paymentProvider: PaymentProviderPort
    ) {}

    async exec(input: GenerateTuitionPixInput): Promise<GenerateTuitionPixOutput> {
        if (!this.paymentProvider.createPixCharge) {
            throw new Error('Configured payment provider does not support PIX issuance');
        }

        // Buscar a mensalidade específica
        const charge = await this.charges.findById(input.chargeId);
        if (!charge) {
            throw new Error('Charge not found');
        }

        if (charge.chargeType !== 'TUITION') {
            throw new Error('Charge type is not TUITION');
        }

        // Verificar se a mensalidade está em um status que permite gerar PIX
        if (!this.allowedStatuses.has(charge.status)) {
            throw new Error(`Charge status (${charge.status}) does not allow PIX generation`);
        }

        this.ensureRequesterCanGenerate(input.requester, charge.schoolId, charge.ownerUserId);

        // Buscar curso para retornar o nome
        const course = await this.courses.findById(charge.courseId);
        if (!course) {
            throw new Error('Course not found');
        }

        // Se já tem PIX gerado, retornar existente
        if (charge.asaasPaymentId) {
            const payload = charge.asaasPayload ?? {};
            const pixQrCode = typeof payload.pixQrCode === 'string' ? payload.pixQrCode : null;
            const pixCopiaECola = typeof payload.pixCopiaECola === 'string' ? payload.pixCopiaECola : null;
            
            return {
                chargeId: charge.id,
                paymentProviderRef: charge.asaasPaymentId,
                pixQrCode,
                pixCopiaECola,
                invoiceUrl: charge.asaasInvoiceUrl,
                dueDate: charge.dueDate,
                status: charge.status,
                amountCents: charge.netAmountCents,
                courseName: course.name
            };
        }

        const owner = await this.users.findById(charge.ownerUserId);
        if (!owner) {
            throw new Error('Owner user not found');
        }

        const address = owner.address.toPrimitives();
        const amount = Money.of(charge.netAmountCents, 'BRL');

        // Para mensalidades, usar a conta Asaas da escola se disponível
        const provider = await this.resolvePaymentProvider(charge);

        if (!provider.createPixCharge) {
            throw new Error('Payment provider does not support PIX issuance');
        }

        // Garantir que dueDate seja um objeto Date
        const dueDate = charge.dueDate instanceof Date 
            ? charge.dueDate 
            : new Date(charge.dueDate);

        const pix = await provider.createPixCharge({
            amount,
            dueDate,
            description: charge.description ?? 'Mensalidade',
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
            paymentId: pix.providerRef,
            invoiceUrl: pix.invoiceUrl ?? null,
            payload: {
                pixQrCode: pix.pixQrCode ?? null,
                pixCopiaECola: pix.pixCopiaECola ?? null,
                dueDate: pix.dueDate.toISOString()
            }
        });

        await this.charges.save(charge);

        return {
            chargeId: charge.id,
            paymentProviderRef: charge.asaasPaymentId!,
            pixQrCode: pix.pixQrCode,
            pixCopiaECola: pix.pixCopiaECola,
            invoiceUrl: pix.invoiceUrl,
            dueDate: pix.dueDate,
            status: charge.status,
            amountCents: charge.netAmountCents,
            courseName: course.name
        };
    }

    private ensureRequesterCanGenerate(
        requester: GenerateTuitionPixInput['requester'],
        schoolId: string,
        ownerUserId: string
    ) {
        switch (requester.persona) {
            case UserPersonaEnum.STUDENT:
                if (ownerUserId !== requester.id) {
                    throw new Error('User not allowed to generate PIX for this charge');
                }
                break;
            case UserPersonaEnum.SCHOOL:
                if (!requester.schoolId || requester.schoolId !== schoolId) {
                    throw new Error('User not allowed to generate PIX for this charge');
                }
                break;
            case UserPersonaEnum.ADMIN:
                break;
            default:
                throw new Error('User not allowed to generate PIX for this charge');
        }
    }

    private buildMetadata(charge: {
        id: string;
        schoolId: string;
        ownerUserId: string;
        dependentId: string | null;
        courseId: string;
        courseClassId: string | null;
    }): Record<string, string> {
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
        metadata.type = 'TUITION';
        return metadata;
    }

    /**
     * Resolve o provider de pagamento a ser usado.
     * Para mensalidades, usa a conta Asaas da escola se disponível.
     * Caso contrário, usa o provider principal.
     */
    private async resolvePaymentProvider(
        charge: import('../../domain/entities/school-financial-charge').SchoolFinancialCharge
    ): Promise<PaymentProviderPort> {
        // Apenas para mensalidades
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

