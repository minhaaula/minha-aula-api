import { SchoolRepository } from '../../ports/repositories/school.repo';
import { SchoolPlanFinanceRepository } from '../../ports/repositories/school-plan-finance.repo';
import { SchoolPlanInvoiceRepository } from '../../ports/repositories/school-plan-invoice.repo';
import type { SchoolImageRepository } from '../../ports/repositories/school-image.repo';
import type { AsaasProviderPort } from '../../ports/providers/asaas-port';
import type { StorageProviderPort } from '../../ports/providers/storage-provider.port';
import { presentAdminSchoolAsaasAccountFromSchool } from '../presenters/admin-school-asaas-account.presenter';
import { presentSchoolPlanFinance } from '../presenters/school-plan-finance.presenter';
import type { AdminSchoolDetails } from '../types/admin.types';
import { resolveSchoolLogoUrl } from '../utils/school-logo-url';
import { AppError, ErrorCode } from '../../shared/errors';
import { resolveSchoolProfileOnboarding } from './resolve-school-profile-onboarding';

export class GetAdminSchoolDetails {
    constructor(
        private readonly schools: SchoolRepository,
        private readonly planFinances: SchoolPlanFinanceRepository,
        private readonly planInvoices: SchoolPlanInvoiceRepository,
        private readonly asaasProvider?: AsaasProviderPort,
        private readonly schoolImages?: SchoolImageRepository,
        private readonly storage?: StorageProviderPort | null
    ) {}

    async exec(input: { schoolId: string }): Promise<AdminSchoolDetails> {
        const schoolId = input.schoolId.trim();
        if (!schoolId) {
            throw AppError.fromCode(ErrorCode.REQUIRED_FIELD, { field: 'schoolId' });
        }

        if (this.schools.isDeleted && (await this.schools.isDeleted(schoolId))) {
            throw AppError.fromCode(ErrorCode.SCHOOL_NOT_FOUND, { schoolId });
        }

        let school = await this.schools.findById(schoolId);
        if (!school) {
            throw AppError.fromCode(ErrorCode.SCHOOL_NOT_FOUND, { schoolId });
        }

        const activeFinance = await this.planFinances.findActiveBySchoolId(school.id);
        const plan = activeFinance ? presentSchoolPlanFinance(activeFinance) : null;

        const hasCompletedFirstPayment = await this.planInvoices.hasSchoolAnyPaidInvoice(school.id);

        const { school: schoolResolved, onboarding } = await resolveSchoolProfileOnboarding({
            school,
            hasCompletedFirstPayment,
            schools: this.schools,
            asaasProvider: this.asaasProvider
        });
        school = schoolResolved;

        const onboardingCompleted = school.onboardingCompletedAt !== null;

        // Escola sem primeiro pagamento E sem onboarding completo não pode ser ACTIVE.
        // INACTIVE quando: (não fez primeiro pagamento E não tem onboarding completo), ou pediu encerramento, ou plano não ACTIVE/TRIAL.
        const planWouldBeActive = plan && (plan.status === 'ACTIVE' || plan.status === 'TRIAL');
        const hasFirstPaymentOrOnboarding = hasCompletedFirstPayment || onboardingCompleted;
        const schoolStatus =
            !hasFirstPaymentOrOnboarding || !planWouldBeActive
                ? ('INACTIVE' as const)
                : ('ACTIVE' as const);
        const paymentStatus = !plan ? null : (plan.status === 'ACTIVE' || plan.status === 'TRIAL' ? 'EM_DIA' : 'ATRASADO');

        const schoolLogo = await resolveSchoolLogoUrl(school.id, this.schoolImages, this.storage);

        return {
            id: school.id,
            name: school.name,
            schoolLogo,
            email: school.email,
            phone: school.phone,
            cnpj: school.cnpj,
            addresses: school.addresses.map((address) => address.toPrimitives()),
            createdAt: school.createdAt,
            ownerName: school.ownerName,
            ownerCpf: school.ownerCpf,
            ownerEmail: school.ownerEmail,
            ownerBirthDate: school.ownerBirthDate ? school.ownerBirthDate.toISOString().slice(0, 10) : null,
            ownerWhatsapp: school.ownerWhatsapp,
            schoolStatus,
            paymentStatus,
            plan,
            incomeValue: school.incomeValue,
            ownerUserId: school.ownerUserId,
            accountId: school.accountId,
            walletId: school.walletId,
            onboardingUrl: school.onboardingUrl,
            onboardingCompleted,
            onboardingCompletedAt: school.onboardingCompletedAt,
            hasCompletedFirstPayment,
            onboarding,
            asaasAccount: presentAdminSchoolAsaasAccountFromSchool(school)
        };
    }
}

