import type { SchoolRepository } from '../../ports/repositories/school.repo';
import type { AsaasProviderPort, AsaasPendingDocumentGroup } from '../../ports/providers/asaas-port';
import { AppError, ErrorCode } from '../../shared/errors';

export interface SyncSchoolOnboardingDocumentsInput {
    schoolId: string;
}

export interface SyncSchoolOnboardingDocumentsOutput {
    schoolId: string;
    documents: Array<{
        id: string;
        type: string;
        title: string;
        description: string;
        status: string;
        onboardingUrl: string | null;
        onboardingUrlExpirationDate: string | null;
    }>;
    /** URL para redirecionar o cliente ao envio de documentos (link cadastro.io). Atualizada na escola quando disponível. */
    onboardingUrl: string | null;
    /** Indica se a escola foi atualizada com nova onboardingUrl. */
    onboardingUrlUpdated: boolean;
}

/**
 * Sincroniza documentos pendentes da escola com o Asaas e persiste a onboardingUrl.
 * Conforme documentação Asaas: GET /v3/myAccount/documents (recomenda-se aguardar 15s após criar a subconta).
 * Escolas já com conta podem chamar a qualquer momento para atualizar a lista e a URL.
 */
export class SyncSchoolOnboardingDocuments {
    constructor(
        private readonly schools: SchoolRepository,
        private readonly asaasProvider?: AsaasProviderPort
    ) {}

    async exec(input: SyncSchoolOnboardingDocumentsInput): Promise<SyncSchoolOnboardingDocumentsOutput> {
        const schoolId = input.schoolId?.trim();
        if (!schoolId) {
            throw AppError.fromCode(ErrorCode.REQUIRED_FIELD, { field: 'schoolId' });
        }

        const school = await this.schools.findById(schoolId);
        if (!school) {
            throw AppError.notFound('Escola', { schoolId });
        }

        if (!school.accountApiKey) {
            return {
                schoolId: school.id,
                documents: [],
                onboardingUrl: school.onboardingUrl,
                onboardingUrlUpdated: false
            };
        }

        if (!this.asaasProvider?.getPendingDocuments) {
            return {
                schoolId: school.id,
                documents: [],
                onboardingUrl: school.onboardingUrl,
                onboardingUrlUpdated: false
            };
        }

        const result = await this.asaasProvider.getPendingDocuments(school.accountApiKey);
        const groups = result.data ?? [];
        const documents = groups.map((g: AsaasPendingDocumentGroup) => ({
            id: g.id,
            type: g.type,
            title: g.title,
            description: g.description,
            status: g.status,
            onboardingUrl: g.onboardingUrl,
            onboardingUrlExpirationDate: g.onboardingUrlExpirationDate
        }));

        const chosenUrl = this.pickBestOnboardingUrl(groups);
        let onboardingUrlUpdated = false;

        if (chosenUrl && chosenUrl !== school.onboardingUrl) {
            const updated = school.withOnboardingUrl(chosenUrl);
            await this.schools.save(updated);
            onboardingUrlUpdated = true;
        }

        const onboardingUrl = chosenUrl ?? school.onboardingUrl;

        return {
            schoolId: school.id,
            documents,
            onboardingUrl,
            onboardingUrlUpdated
        };
    }

    /**
     * Escolhe a melhor onboardingUrl: primeira não expirada; se todas expiradas, a primeira disponível.
     */
    private pickBestOnboardingUrl(groups: AsaasPendingDocumentGroup[]): string | null {
        const now = new Date();
        let firstValid: string | null = null;
        let firstAny: string | null = null;

        for (const g of groups) {
            const url = g.onboardingUrl?.trim() || null;
            if (!url) continue;
            firstAny = firstAny ?? url;
            const exp = g.onboardingUrlExpirationDate ? new Date(g.onboardingUrlExpirationDate) : null;
            if (!exp || exp > now) {
                firstValid = firstValid ?? url;
            }
        }
        return firstValid ?? firstAny;
    }
}
