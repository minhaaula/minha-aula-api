import { SchoolPlanInvoiceRepository } from '../../ports/repositories/school-plan-invoice.repo';
import { SchoolRepository } from '../../ports/repositories/school.repo';
import { AsaasProviderPort } from '../../ports/providers/asaas-port';
import { SchoolPlanInvoice } from '../../domain/entities/school-plan-invoice';

export interface EnsureSchoolAsaasAccountInput {
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
        if (!invoiceId) return { done: true };

        const invoice = await this.invoices.findById(invoiceId);
        if (!invoice || invoice.status !== 'PAID') {
            return { done: true };
        }

        if (!this.asaasProvider?.createSubAccount) {
            return { done: true };
        }

        const school = await this.schools.findById(invoice.schoolId);
        if (!school) {
            return { done: true };
        }

        if (!school.name?.trim() || !school.email?.trim()) return { done: true };
        if (!school.cnpj || school.cnpj.length !== 14) return { done: true };
        if (!school.phone || school.phone.length < 10) return { done: true };

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
            return { done: true };
        }

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
            const isEmailAlreadyInUse = /já está em uso|already in use|email.*em uso/i.test(message);
            if (isEmailAlreadyInUse && this.asaasProvider?.listAccountsByEmail) {
                const existing = await this.asaasProvider.listAccountsByEmail(school.email);
                const byExternalRef = existing.find(
                    (acc: { externalReference?: string | null }) => acc.externalReference === school.id
                );
                const found = byExternalRef ?? existing[0];
                if (found?.id) {
                    subAccount = found;
                } else {
                    return { done: true };
                }
            } else {
                return { done: true };
            }
        }

        if (!subAccount?.id?.trim()) return { done: true };

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
            return {
                done: true,
                onboardingPending: { schoolId: invoice.schoolId, accountApiKey: accountApiKeyForOnboarding }
            };
        }
        return { done: true };
    }

    private async saveInvoiceMetadata(invoice: SchoolPlanInvoice, metadata: Record<string, string>): Promise<void> {
        const updated = invoice.withChanges({ metadata, updatedAt: new Date() });
        await this.invoices.save(updated);
    }
}
