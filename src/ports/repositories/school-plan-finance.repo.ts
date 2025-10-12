import { SchoolPlanFinance } from '../../domain/entities/school-plan-finance';

export interface SchoolPlanFinanceRepository {
    findById(id: string): Promise<SchoolPlanFinance | null>;
    findActiveBySchoolId(schoolId: string): Promise<SchoolPlanFinance | null>;
    save(finance: SchoolPlanFinance): Promise<void>;
}
