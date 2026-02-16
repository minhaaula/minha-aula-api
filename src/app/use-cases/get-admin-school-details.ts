import { SchoolRepository } from '../../ports/repositories/school.repo';
import { SchoolPlanFinanceRepository } from '../../ports/repositories/school-plan-finance.repo';
import { SchoolPlanInvoiceRepository } from '../../ports/repositories/school-plan-invoice.repo';
import { presentSchoolPlanFinance } from '../presenters/school-plan-finance.presenter';
import type { AdminSchoolDetails } from '../types/admin.types';
import { AppError, ErrorCode } from '../../shared/errors';

export class GetAdminSchoolDetails {
    constructor(
        private readonly schools: SchoolRepository,
        private readonly planFinances: SchoolPlanFinanceRepository,
        private readonly planInvoices: SchoolPlanInvoiceRepository
    ) {}

    async exec(input: { schoolId: string }): Promise<AdminSchoolDetails> {
        const schoolId = input.schoolId.trim();
        if (!schoolId) {
            throw AppError.fromCode(ErrorCode.REQUIRED_FIELD, { field: 'schoolId' });
        }

        const school = await this.schools.findById(schoolId);
        if (!school) {
            throw AppError.fromCode(ErrorCode.SCHOOL_NOT_FOUND, { schoolId });
        }

        const activeFinance = await this.planFinances.findActiveBySchoolId(school.id);
        const plan = activeFinance ? presentSchoolPlanFinance(activeFinance) : null;

        const onboardingCompleted = school.onboardingCompletedAt !== null;
        const hasCompletedFirstPayment = await this.planInvoices.hasSchoolAnyPaidInvoice(school.id);

        const schoolStatus = !plan ? 'INACTIVE' as const : (plan.status === 'ACTIVE' || plan.status === 'TRIAL' ? 'ACTIVE' : 'INACTIVE');
        const paymentStatus = !plan ? null : (plan.status === 'ACTIVE' || plan.status === 'TRIAL' ? 'EM_DIA' : 'ATRASADO');

        return {
            id: school.id,
            name: school.name,
            email: school.email,
            phone: school.phone,
            cnpj: school.cnpj,
            addresses: school.addresses.map((address) => address.toPrimitives()),
            createdAt: school.createdAt,
            ownerName: school.ownerName,
            ownerCpf: school.ownerCpf,
            ownerEmail: school.ownerEmail,
            schoolStatus,
            paymentStatus,
            plan,
            incomeValue: school.incomeValue,
            ownerUserId: school.ownerUserId,
            accountId: school.accountId,
            accountApiKey: school.accountApiKey,
            walletId: school.walletId,
            onboardingUrl: school.onboardingUrl,
            onboardingCompleted,
            onboardingCompletedAt: school.onboardingCompletedAt,
            hasCompletedFirstPayment
        };
    }
}

