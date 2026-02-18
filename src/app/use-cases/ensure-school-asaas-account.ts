import { SchoolPlanInvoiceRepository } from '../../ports/repositories/school-plan-invoice.repo';
import { SchoolRepository } from '../../ports/repositories/school.repo';
import { AsaasProviderPort } from '../../ports/providers/asaas-port';
import { SchoolPlanInvoice } from '../../domain/entities/school-plan-invoice';
import { log } from '../../shared/logger';

export interface EnsureSchoolAsaasAccountInput {
    /** ID do invoice pago; a subconta Asaas é criada/vinculada para a escola desse invoice. */
    invoiceId: string;
}

export interface EnsureSchoolAsaasAccountOutput {
    done: boolean;
    /** Se a subconta foi criada/vinculada e tem apiKey, o worker deve aguardar ~15s e buscar onboarding URL. */
    onboardingPending?: { schoolId: string; accountApiKey: string };
}

const ALLOWED_COMPANY_TYPES = new Set(['MEI', 'LIMITED', 'INDIVIDUAL', 'ASSOCIATION']);

/**
 * Garante subconta Asaas para a escola do invoice pago.
 * Chamado pelo worker após o webhook enfileirar o job (evita bloquear resposta do webhook).
 */
export class EnsureSchoolAsaasAccount {
    constructor(
        private readonly invoices: SchoolPlanInvoiceRepository,
        private readonly schools: SchoolRepository,
        private readonly asaasProvider?: AsaasProviderPort
    ) {}

    async exec(input: EnsureSchoolAsaasAccountInput): Promise<EnsureSchoolAsaasAccountOutput> {
        const invoiceId = input.invoiceId?.trim();
        log.info('[EnsureSchoolAsaasAccount] Início', { invoiceId });

        if (!invoiceId) {
            log.warn('[EnsureSchoolAsaasAccount] Encerrado: invoiceId ausente');
            return { done: true };
        }

        const invoice = await this.invoices.findById(invoiceId);
        if (!invoice) {
            log.warn('[EnsureSchoolAsaasAccount] Encerrado: invoice não encontrado', { invoiceId });
            return { done: true };
        }
        if (invoice.status !== 'PAID') {
            log.warn('[EnsureSchoolAsaasAccount] Encerrado: invoice não está PAID', { invoiceId, status: invoice.status });
            return { done: true };
        }

        if (!this.asaasProvider?.createSubAccount) {
            log.warn('[EnsureSchoolAsaasAccount] Encerrado: Asaas provider não configurado (createSubAccount ausente)', { invoiceId });
            return { done: true };
        }

        const school = await this.schools.findById(invoice.schoolId);
        if (!school) {
            log.warn('[EnsureSchoolAsaasAccount] Encerrado: escola não encontrada', { invoiceId, schoolId: invoice.schoolId });
            return { done: true };
        }

        if (!school.name?.trim() || !school.email?.trim()) {
            log.warn('[EnsureSchoolAsaasAccount] Encerrado: escola sem nome ou email', { invoiceId, schoolId: school.id });
            return { done: true };
        }
        if (!school.cnpj || school.cnpj.length !== 14) {
            log.warn('[EnsureSchoolAsaasAccount] Encerrado: CNPJ da escola inválido', { invoiceId, schoolId: school.id });
            return { done: true };
        }
        if (!school.phone || school.phone.length < 10) {
            log.warn('[EnsureSchoolAsaasAccount] Encerrado: telefone da escola inválido (mín. 10 dígitos)', { invoiceId, schoolId: school.id });
            return { done: true };
        }

        const metadata = { ...invoice.metadata };
        const metadataAccountId = metadata.accountId ?? metadata.asaasSubAccountId ?? metadata.paymentAccountId;
        const metadataStatus = metadata.accountStatus ?? metadata.asaasSubAccountStatus ?? metadata.paymentAccountStatus;
        const rawCompanyType = metadata.accountCompanyType ?? metadata.companyType;
        const normalizedCompanyType =
            typeof rawCompanyType === 'string' && ALLOWED_COMPANY_TYPES.has(rawCompanyType.trim().toUpperCase())
                ? rawCompanyType.trim().toUpperCase()
                : 'LIMITED';
        const rawIncomeValue = metadata.accountIncomeValue ?? metadata.incomeValue;
        const parsedIncomeValue =
            typeof rawIncomeValue === 'string'
                ? Number(rawIncomeValue.trim())
                : typeof rawIncomeValue === 'number'
                  ? rawIncomeValue
                  : undefined;
        const defaultIncomeValue = school.incomeValue > 0 ? school.incomeValue : 5000;
        const incomeValue =
            Number.isFinite(parsedIncomeValue) && (parsedIncomeValue as number) > 0
                ? Math.round(parsedIncomeValue as number)
                : defaultIncomeValue;
        if (!Number.isFinite(incomeValue) || incomeValue <= 0) return { done: true };

        let accountApiKeyForOnboarding: string | null = null;

        if (school.accountId?.trim()) {
            log.info('[EnsureSchoolAsaasAccount] Escola já possui conta Asaas, apenas atualizando metadata do invoice', { schoolId: school.id, accountId: school.accountId });
            metadata.accountId = school.accountId;
            if (metadataStatus) metadata.accountStatus = metadataStatus;
            metadata.accountLinkedAt = metadata.accountLinkedAt ?? new Date().toISOString();
            metadata.accountCompanyType = normalizedCompanyType;
            metadata.accountIncomeValue = String(incomeValue);
            await this.saveInvoiceMetadata(invoice, metadata);
            return { done: true };
        }

        if (metadataAccountId?.trim()) {
            const updatedSchool = school.withAccountId(metadataAccountId);
            await this.schools.save(updatedSchool);
            metadata.accountId = metadataAccountId;
            if (metadataStatus) metadata.accountStatus = metadataStatus;
            metadata.accountLinkedAt = metadata.accountLinkedAt ?? new Date().toISOString();
            metadata.accountCompanyType = normalizedCompanyType;
            metadata.accountIncomeValue = String(incomeValue);
            await this.saveInvoiceMetadata(invoice, metadata);
            return { done: true };
        }

        const mainAddress = school.addresses[0];
        if (
            !mainAddress?.street?.trim() ||
            !mainAddress?.number?.trim() ||
            !mainAddress.zipCode ||
            mainAddress.zipCode.length !== 8
        ) {
            log.warn('[EnsureSchoolAsaasAccount] Encerrado: endereço da escola incompleto (rua, número e CEP 8 dígitos)', {
                invoiceId,
                schoolId: school.id,
                hasStreet: Boolean(mainAddress?.street?.trim()),
                hasNumber: Boolean(mainAddress?.number?.trim()),
                zipCodeLength: mainAddress?.zipCode?.length ?? 0
            });
            return { done: true };
        }

        log.info('[EnsureSchoolAsaasAccount] Chamando Asaas createSubAccount', { invoiceId, schoolId: school.id });
        let subAccount: { id: string; apiKey?: string; walletId?: string; status?: string };
        try {
            subAccount = await this.asaasProvider.createSubAccount({
                name: school.name,
                email: school.email,
                cpfCnpj: school.cnpj,
                phone: school.phone,
                externalReference: school.id,
                companyType: normalizedCompanyType,
                incomeValue,
                address: mainAddress.street,
                addressNumber: mainAddress.number,
                complement: mainAddress.complement ?? null,
                province: mainAddress.district ?? null,
                postalCode: mainAddress.zipCode
            });
        } catch (createError: unknown) {
            const message = createError instanceof Error ? createError.message : String(createError);
            log.warn('[EnsureSchoolAsaasAccount] Erro ao criar subconta Asaas', {
                invoiceId,
                schoolId: school.id,
                errorMessage: message.substring(0, 200)
            });
            const isEmailAlreadyInUse = /já está em uso|already in use|email.*em uso/i.test(message);
            if (isEmailAlreadyInUse && this.asaasProvider?.listAccountsByEmail) {
                log.info('[EnsureSchoolAsaasAccount] Tentando vincular conta existente por e-mail', { invoiceId, schoolId: school.id });
                const existing = await this.asaasProvider.listAccountsByEmail(school.email);
                const byExternalRef = existing.find(
                    (acc: { externalReference?: string | null }) => acc.externalReference === school.id
                );
                const found = byExternalRef ?? existing[0];
                if (found?.id) {
                    subAccount = found;
                } else {
                    log.warn('[EnsureSchoolAsaasAccount] Nenhuma conta encontrada por e-mail para vincular', { invoiceId, schoolId: school.id });
                    return { done: true };
                }
            } else {
                return { done: true };
            }
        }

        if (!subAccount?.id?.trim()) {
            log.warn('[EnsureSchoolAsaasAccount] Encerrado: createSubAccount não retornou id', { invoiceId, schoolId: school.id });
            return { done: true };
        }

        log.info('[EnsureSchoolAsaasAccount] Subconta criada/vinculada, salvando na escola', {
            invoiceId,
            schoolId: school.id,
            accountId: subAccount.id,
            hasApiKey: Boolean(subAccount.apiKey),
            hasWalletId: Boolean(subAccount.walletId)
        });

        let updatedSchool = school.withAccountId(subAccount.id);
        if (subAccount.apiKey) updatedSchool = updatedSchool.withAccountApiKey(subAccount.apiKey);
        if (subAccount.walletId) updatedSchool = updatedSchool.withWalletId(subAccount.walletId);
        await this.schools.save(updatedSchool);

        metadata.accountId = subAccount.id;
        if (subAccount.status) metadata.accountStatus = subAccount.status;
        metadata.accountLinkedAt = new Date().toISOString();
        metadata.accountCompanyType = normalizedCompanyType;
        metadata.accountIncomeValue = String(incomeValue);
        if (subAccount.apiKey) {
            metadata.accountApiKey = subAccount.apiKey;
            accountApiKeyForOnboarding = subAccount.apiKey;
        }
        await this.saveInvoiceMetadata(invoice, metadata);

        if (accountApiKeyForOnboarding) {
            log.info('[EnsureSchoolAsaasAccount] Sucesso: retornando onboardingPending para worker buscar URL', {
                invoiceId,
                schoolId: invoice.schoolId
            });
            return {
                done: true,
                onboardingPending: { schoolId: invoice.schoolId, accountApiKey: accountApiKeyForOnboarding }
            };
        }
        log.info('[EnsureSchoolAsaasAccount] Concluído sem onboarding (sem apiKey)', { invoiceId, schoolId: school.id });
        return { done: true };
    }

    private async saveInvoiceMetadata(invoice: SchoolPlanInvoice, metadata: Record<string, string>): Promise<void> {
        const updated = invoice.withChanges({ metadata, updatedAt: new Date() });
        await this.invoices.save(updated);
    }
}
