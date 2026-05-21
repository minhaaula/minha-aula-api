import { SchoolPlanFinanceRepository } from '../../../ports/repositories/school-plan-finance.repo';
import { presentSchoolPlanFinance, SchoolPlanFinanceView } from '../../presenters/school-plan-finance.presenter';

export class GetActiveSchoolPlan {
    constructor(private readonly finances: SchoolPlanFinanceRepository) {}

    async exec(input: { schoolId: string }): Promise<SchoolPlanFinanceView | null> {
        const finance = await this.finances.findActiveBySchoolId(input.schoolId);
        if (!finance) return null;

        return presentSchoolPlanFinance(finance);
    }
}
