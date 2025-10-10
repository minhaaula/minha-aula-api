import { SchoolPlanFinance } from '../../domain/entities/school-plan-finance';

export interface SchoolPlanFinanceRepository {
    findActiveBySchoolId(schoolId: string): Promise<SchoolPlanFinance | null>;
    save(finance: SchoolPlanFinance): Promise<void>;
}
