import { SchoolPlanFinanceRepository } from '../../../ports/repositories/school-plan-finance.repo';
import { presentSchoolPlanFinance, type SchoolPlanFinanceView } from '../../presenters/school-plan-finance.presenter';
import type { AdminSchoolPlansResponse } from '../../types/admin.types';
import { AppError, ErrorCode } from '../../../shared/errors';

export class GetAdminSchoolPlans {
    constructor(
        private readonly planFinances: SchoolPlanFinanceRepository
    ) {}

    async exec(input: { schoolId: string }): Promise<AdminSchoolPlansResponse> {
        const schoolId = input.schoolId.trim();
        if (!schoolId) {
            throw AppError.fromCode(ErrorCode.REQUIRED_FIELD, { field: 'schoolId' });
        }

        const finances = await this.planFinances.findAllBySchoolIds([schoolId]);

        if (!finances.length) {
            return {
                currentPlan: null,
                history: []
            };
        }

        const views: SchoolPlanFinanceView[] = finances
            .map((finance) => presentSchoolPlanFinance(finance))
            .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

        const currentPlan = views[views.length - 1] ?? null;

        return {
            currentPlan,
            history: views
        };
    }
}

