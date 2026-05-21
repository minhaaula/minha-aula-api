import type { SchoolRepository } from '../../../ports/repositories/school.repo';
import type { AsaasProviderPort } from '../../../ports/providers/asaas-port';
import type { School, SchoolAccountStatusSnapshot } from '../../../domain/entities/school';
import { schoolAccountStatusSectionsEqual } from '../../../domain/entities/school';
import type { SchoolProfileAsaasOnboardingStatus, SchoolProfileOnboarding } from '../../types/school.types';

export type ResolveSchoolProfileOnboardingParams = {
    school: School;
    hasCompletedFirstPayment: boolean;
    schools: SchoolRepository;
    asaasProvider?: AsaasProviderPort;
};

export type ResolveSchoolProfileOnboardingResult = {
    school: School;
    onboarding: SchoolProfileOnboarding;
};

/**
 * Monta `onboarding` como no GET `/schools/me`: consulta opcional ao Asaas, persistência do snapshot/onboarding quando muda,
 * fallback para snapshot gravado pelos webhooks.
 */
export async function resolveSchoolProfileOnboarding({
    school: initialSchool,
    hasCompletedFirstPayment,
    schools,
    asaasProvider
}: ResolveSchoolProfileOnboardingParams): Promise<ResolveSchoolProfileOnboardingResult> {
    let school = initialSchool;
    let onboardingCompleted = school.onboardingCompletedAt !== null;

    let asaasOnboardingStatus: SchoolProfileAsaasOnboardingStatus | null = null;
    if (school.onboardingCompletedAt !== null) {
        asaasOnboardingStatus = {
            id: school.accountId?.trim() ?? '',
            commercialInfo: 'APPROVED',
            bankAccountInfo: 'APPROVED',
            documentation: 'APPROVED',
            general: 'APPROVED',
            onboardingCompletedAt: school.onboardingCompletedAt,
            lastEvent: school.accountStatusSnapshot?.lastEvent ?? null,
            lastEventAt: school.accountStatusSnapshot?.lastEventAt ?? null
        };
    } else if (school.accountApiKey?.trim() && asaasProvider?.getAccountStatus) {
        try {
            const status = await asaasProvider.getAccountStatus(school.accountApiKey);
            if (status) {
                const allApproved =
                    status.commercialInfo === 'APPROVED' &&
                    status.bankAccountInfo === 'APPROVED' &&
                    status.documentation === 'APPROVED' &&
                    status.general === 'APPROVED';

                const patch: SchoolAccountStatusSnapshot = {
                    commercialInfo: status.commercialInfo,
                    bankAccountInfo: status.bankAccountInfo,
                    documentation: status.documentation,
                    general: status.general
                };
                const previewWithSnapshot = school.withAccountStatusSnapshot(patch);
                const sectionsChanged = !schoolAccountStatusSectionsEqual(
                    school.accountStatusSnapshot,
                    previewWithSnapshot.accountStatusSnapshot
                );
                const bootstrapSnapshot = school.accountStatusSnapshot == null;

                let workingSchool = school;
                let needsSave = false;
                if (allApproved && !school.onboardingCompletedAt) {
                    workingSchool = workingSchool.withOnboardingCompletedAt(new Date());
                    onboardingCompleted = true;
                    needsSave = true;
                }
                if (sectionsChanged || bootstrapSnapshot) {
                    workingSchool = workingSchool.withAccountStatusSnapshot(patch);
                    needsSave = true;
                }
                if (needsSave) {
                    await schools.save(workingSchool);
                    school = workingSchool;
                }

                const onboardingCompletedAt = school.onboardingCompletedAt;

                asaasOnboardingStatus = {
                    id: status.id,
                    commercialInfo: status.commercialInfo,
                    bankAccountInfo: status.bankAccountInfo,
                    documentation: status.documentation,
                    general: status.general,
                    onboardingCompletedAt,
                    lastEvent: school.accountStatusSnapshot?.lastEvent ?? null,
                    lastEventAt: school.accountStatusSnapshot?.lastEventAt ?? null
                };
            }
        } catch {
            // Asaas instável: segue para snapshot persistido (igual `/me`).
        }
    }

    if (!asaasOnboardingStatus && school.accountStatusSnapshot) {
        const snap = school.accountStatusSnapshot;
        asaasOnboardingStatus = {
            id: school.accountId?.trim() ?? '',
            commercialInfo: snap.commercialInfo ?? 'PENDING',
            bankAccountInfo: snap.bankAccountInfo ?? 'PENDING',
            documentation: snap.documentation ?? 'PENDING',
            general: snap.general ?? 'PENDING',
            onboardingCompletedAt: school.onboardingCompletedAt,
            lastEvent: snap.lastEvent ?? null,
            lastEventAt: snap.lastEventAt ?? null
        };
    }

    onboardingCompleted = school.onboardingCompletedAt !== null;

    const onboarding: SchoolProfileOnboarding = {
        completed: onboardingCompleted,
        url: school.onboardingUrl,
        accountId: school.accountId,
        hasCompletedFirstPayment,
        asaasStatus: asaasOnboardingStatus
    };

    return { school, onboarding };
}
