import { SchoolFinancialChargeRepository } from '../../ports/repositories/school-financial-charge.repo';
import { UserRepository } from '../../ports/repositories/user.repo';
import { SchoolRepository } from '../../ports/repositories/school.repo';
import { CourseRepository } from '../../ports/repositories/course.repo';
import { PaymentProviderPort } from '../../ports/providers/payment-provider.port';
import { SchoolImageRepository } from '../../ports/repositories/school-image.repo';
import { SchoolImageCategory } from '../../domain/value-objects/school-image-category';
import type { StorageProviderPort } from '../../ports/providers/storage-provider.port';
import type { AsaasProviderPort } from '../../ports/providers/asaas-port';
import { Money } from '../../domain/value-objects/money';
import { SchoolFinancialChargeStatus } from '../../domain/entities/school-financial-charge';
import { UserPersonaEnum } from '../../domain/value-objects/user-persona';
import { log } from '../../shared/logger';
import {
    formatDiscountMonthsLabel,
    parseDiscountMonthProgress
} from '../../shared/parse-discount-month-progress';
import type { SchoolFinancialCharge } from '../../domain/entities/school-financial-charge';

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
    /** Valor nominal (bruto) da cobrança em centavos, antes do desconto. */
    amountCents: number;
    /** Valor do desconto em centavos, ou null se não houver. */
    discountCents: number | null;
    /** Valor líquido a pagar em centavos (já aplicando desconto). */
    netAmountCents: number;
    courseName: string;
    /** URL do logo da escola, ou null. */
    schoolLogo: string | null;
    /** Ex.: "1 de 2 meses" — progresso do desconto na matrícula. */
    discountMonthsLabel: string | null;
    discountMonthIndex: number | null;
    discountMonthsTotal: number | null;
}

export class GenerateTuitionPix {
    private readonly allowedStatuses = new Set<SchoolFinancialChargeStatus>(['PENDING_SYNC', 'FAILED', 'OPEN', 'OVERDUE']);
    /** Tipos de cobrança que o estudante pode gerar PIX: mensalidade e matrícula. */
    private readonly allowedChargeTypes = new Set(['TUITION', 'ENROLLMENT']);
    private readonly schoolAccountChargeTypes = new Set(['TUITION', 'ENROLLMENT']);

    constructor(
        private readonly charges: SchoolFinancialChargeRepository,
        private readonly users: UserRepository,
        private readonly schools: SchoolRepository,
        private readonly courses: CourseRepository,
        private readonly paymentProvider: PaymentProviderPort,
        private readonly schoolImages?: SchoolImageRepository,
        private readonly storage?: StorageProviderPort
    ) {}

    async exec(input: GenerateTuitionPixInput): Promise<GenerateTuitionPixOutput> {
        if (!this.paymentProvider.createPixCharge) {
            throw new Error('Configured payment provider does not support PIX issuance');
        }

        // Buscar a cobrança (mensalidade ou matrícula)
        const charge = await this.charges.findById(input.chargeId);
        if (!charge) {
            throw new Error('Charge not found');
        }

        if (!this.allowedChargeTypes.has(charge.chargeType)) {
            throw new Error(`Charge type ${charge.chargeType} does not allow PIX generation (allowed: TUITION, ENROLLMENT)`);
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

        // Se já tem cobrança no Asaas, reutilizar id e completar QR em falta (GET /payments/{id}/pixQrCode).
        if (charge.asaasPaymentId) {
            const payload = charge.asaasPayload ?? {};
            let pixQrCode = typeof payload.pixQrCode === 'string' ? payload.pixQrCode : null;
            let pixCopiaECola = typeof payload.pixCopiaECola === 'string' ? payload.pixCopiaECola : null;

            if (!pixQrCode?.trim() && !pixCopiaECola?.trim()) {
                const provider = await this.resolvePaymentProvider(charge);
                const fetched = await this.fetchPixQrViaAsaas(provider, charge.asaasPaymentId, pixQrCode, pixCopiaECola);
                if (fetched.pixQrCode?.trim() || fetched.pixCopiaECola?.trim()) {
                    pixQrCode = fetched.pixQrCode;
                    pixCopiaECola = fetched.pixCopiaECola;
                    charge.markAsSynced({
                        paymentId: charge.asaasPaymentId,
                        invoiceUrl: charge.asaasInvoiceUrl,
                        payload: {
                            ...payload,
                            pixQrCode,
                            pixCopiaECola
                        }
                    });
                    await this.charges.save(charge);
                }
            }

            const schoolLogo = await this.getSchoolLogoUrl(charge.schoolId);
            const discountFields = this.buildDiscountFields(charge);

            return {
                chargeId: charge.id,
                paymentProviderRef: charge.asaasPaymentId,
                pixQrCode,
                pixCopiaECola,
                invoiceUrl: charge.asaasInvoiceUrl,
                dueDate: charge.dueDate,
                status: charge.status,
                amountCents: charge.amountCents,
                discountCents: charge.discountCents,
                netAmountCents: charge.netAmountCents,
                courseName: course.name,
                schoolLogo,
                ...discountFields
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

        let pix = await provider.createPixCharge({
            amount,
            dueDate,
            description: charge.description ?? (charge.chargeType === 'ENROLLMENT' ? 'Matrícula' : 'Mensalidade'),
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

        const fetchedQr = await this.fetchPixQrViaAsaas(
            provider,
            pix.providerRef,
            pix.pixQrCode ?? null,
            pix.pixCopiaECola ?? null
        );
        pix = {
            ...pix,
            pixQrCode: fetchedQr.pixQrCode ?? pix.pixQrCode ?? undefined,
            pixCopiaECola: fetchedQr.pixCopiaECola ?? pix.pixCopiaECola ?? undefined
        };

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

        const schoolLogo = await this.getSchoolLogoUrl(charge.schoolId);
        const discountFields = this.buildDiscountFields(charge);

        return {
            chargeId: charge.id,
            paymentProviderRef: charge.asaasPaymentId!,
            pixQrCode: pix.pixQrCode ?? null,
            pixCopiaECola: pix.pixCopiaECola ?? null,
            invoiceUrl: pix.invoiceUrl,
            dueDate: pix.dueDate,
            status: charge.status,
            amountCents: charge.amountCents,
            discountCents: charge.discountCents,
            netAmountCents: charge.netAmountCents,
            courseName: course.name,
            schoolLogo,
            ...discountFields
        };
    }

    private buildDiscountFields(charge: SchoolFinancialCharge): {
        discountMonthsLabel: string | null;
        discountMonthIndex: number | null;
        discountMonthsTotal: number | null;
    } {
        const progress = parseDiscountMonthProgress(charge.discountReason, charge.discountCents);
        return {
            discountMonthsLabel: formatDiscountMonthsLabel(progress),
            discountMonthIndex: progress?.current ?? null,
            discountMonthsTotal: progress?.total ?? null
        };
    }

    /**
     * O POST /payments do Asaas nem sempre devolve pixQrCode/pixCopiaECola; o cliente HTTP já tenta GET /pixQrCode,
     * mas pode falhar por timing. Repete GET com pequenos atrasos (mesma API key da cobrança — conta principal ou subconta).
     */
    private async fetchPixQrViaAsaas(
        provider: PaymentProviderPort,
        paymentId: string,
        existingQr?: string | null,
        existingCopia?: string | null
    ): Promise<{ pixQrCode: string | null; pixCopiaECola: string | null }> {
        if (existingQr?.trim() || existingCopia?.trim()) {
            return {
                pixQrCode: existingQr?.trim() ? existingQr.trim() : null,
                pixCopiaECola: existingCopia?.trim() ? existingCopia.trim() : null
            };
        }
        const asaas = provider as Partial<AsaasProviderPort>;
        if (typeof asaas.getPixQrCode !== 'function') {
            return { pixQrCode: null, pixCopiaECola: null };
        }
        const delaysMs = [0, 400, 900];
        let lastErr: unknown;
        for (let i = 0; i < delaysMs.length; i++) {
            if (delaysMs[i] > 0) {
                await new Promise((r) => setTimeout(r, delaysMs[i]));
            }
            try {
                const qrData = await asaas.getPixQrCode!(paymentId);
                const pixQrCode =
                    typeof qrData?.encodedImage === 'string' && qrData.encodedImage.trim() ? qrData.encodedImage : null;
                const pixCopiaECola =
                    typeof qrData?.payload === 'string' && qrData.payload.trim() ? qrData.payload : null;
                if (pixQrCode || pixCopiaECola) {
                    return { pixQrCode, pixCopiaECola };
                }
            } catch (e) {
                lastErr = e;
            }
        }
        log.warn('[GenerateTuitionPix] Não foi possível obter QR PIX via GET /payments/{id}/pixQrCode após tentativas', {
            paymentId,
            error: lastErr instanceof Error ? lastErr.message : String(lastErr)
        });
        return { pixQrCode: null, pixCopiaECola: null };
    }

    private async getSchoolLogoUrl(schoolId: string): Promise<string | null> {
        if (!this.schoolImages || !this.storage) return null;
        try {
            const logos = await this.schoolImages.findBySchoolId(schoolId, SchoolImageCategory.LOGO);
            const logo = logos[0];
            if (!logo) return null;
            return await this.storage.getFileUrl(logo.key, 3600);
        } catch {
            return null;
        }
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
        chargeType: string;
    }): Record<string, string> {
        const metadata: Record<string, string> = {
            chargeId: charge.id,
            schoolId: charge.schoolId,
            ownerUserId: charge.ownerUserId,
            courseId: charge.courseId,
            type: charge.chargeType
        };
        if (charge.courseClassId) {
            metadata.courseClassId = charge.courseClassId;
        }
        if (charge.dependentId) {
            metadata.dependentId = charge.dependentId;
        }
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
        // Apenas para mensalidade e matrícula: usar conta Asaas da escola se disponível
        if (!this.schoolAccountChargeTypes.has(charge.chargeType)) {
            return this.paymentProvider;
        }

        // Buscar escola para verificar se tem conta Asaas
        const school = await this.schools.findById(charge.schoolId);
        if (!school || !school.accountId) {
            // Se não tiver conta Asaas, usar provider principal
            console.log(`[GenerateTuitionPix] Usando provider principal (escola ${charge.schoolId} não tem accountId)`);
            return this.paymentProvider;
        }

        // Verificar se tem API key da subconta
        const accountApiKey = school.accountApiKey;
        if (!accountApiKey || !accountApiKey.trim()) {
            // Se não tiver API key, usar provider principal
            console.log(`[GenerateTuitionPix] Usando provider principal (escola ${charge.schoolId} não tem accountApiKey)`);
            return this.paymentProvider;
        }

        // Criar provider com a API key da subconta da escola
        const { AsaasProviderFactory } = await import('../../infra/providers/asaas/asaas-provider-factory.js');
        const subAccountProvider = AsaasProviderFactory.createSubAccountProvider(accountApiKey);
        if (!subAccountProvider) {
            console.log(`[GenerateTuitionPix] Usando provider principal (falha ao criar provider da subconta)`);
            return this.paymentProvider;
        }
        return subAccountProvider as PaymentProviderPort;
    }
}

