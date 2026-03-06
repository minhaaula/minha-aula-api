import type { SchoolRepository } from '../../ports/repositories/school.repo';
import type { AsaasProviderPort, AsaasAccountStatus } from '../../ports/providers/asaas-port';
import { AppError, ErrorCode } from '../../shared/errors';

export interface SyncSchoolSubaccountStatusInput {
    schoolId: string;
}

export interface SyncSchoolSubaccountStatusOutput {
    schoolId: string;
    /** Status retornado pelo Asaas (GET /v3/myAccount/status). Não é persistido; consulta direta na API. */
    status: AsaasAccountStatus;
    /** Se o onboarding foi marcado como concluído nesta chamada (todos os status Asaas APPROVED). */
    onboardingCompletedAt: Date | null;
}

/**
 * Consulta o status cadastral da subconta Asaas da escola (GET /v3/myAccount/status) e retorna os dados.
 * Não persiste o status; apenas chama o Asaas e devolve a resposta.
 * Quando commercialInfo, bankAccountInfo, documentation e general estiverem todos APPROVED,
 * marca o onboarding como concluído (onboardingCompletedAt) no nosso lado.
 */
export class SyncSchoolSubaccountStatus {
    constructor(
        private readonly schools: SchoolRepository,
        private readonly asaasProvider?: AsaasProviderPort
    ) {}

    async exec(input: SyncSchoolSubaccountStatusInput): Promise<SyncSchoolSubaccountStatusOutput> {
        const schoolId = input.schoolId?.trim();
        if (!schoolId) {
            throw AppError.fromCode(ErrorCode.REQUIRED_FIELD, { field: 'schoolId' });
        }

        const school = await this.schools.findById(schoolId);
        if (!school) {
            throw AppError.notFound('Escola', { schoolId });
        }

        if (!school.accountApiKey) {
            throw AppError.fromCode(ErrorCode.VALIDATION_ERROR, {
                message: 'Escola não possui API key da subconta Asaas'
            });
        }

        if (!this.asaasProvider?.getAccountStatus) {
            throw AppError.fromCode(ErrorCode.PAYMENT_PROVIDER_NOT_CONFIGURED, {
                message: 'Provedor Asaas não configurado ou não suporta consulta de status da subconta'
            });
        }

        const status = await this.asaasProvider.getAccountStatus(school.accountApiKey);
        if (!status) {
            throw AppError.fromCode(ErrorCode.EXTERNAL_SERVICE_ERROR, {
                message: 'Não foi possível obter o status da subconta no Asaas'
            });
        }

        const allApproved =
            status.commercialInfo === 'APPROVED' &&
            status.bankAccountInfo === 'APPROVED' &&
            status.documentation === 'APPROVED' &&
            status.general === 'APPROVED';

        let onboardingCompletedAt = school.onboardingCompletedAt;
        if (allApproved && !school.onboardingCompletedAt) {
            const updated = school.withOnboardingCompletedAt(new Date());
            await this.schools.save(updated);
            onboardingCompletedAt = updated.onboardingCompletedAt;
        }

        return {
            schoolId: school.id,
            status,
            onboardingCompletedAt
        };
    }
}
