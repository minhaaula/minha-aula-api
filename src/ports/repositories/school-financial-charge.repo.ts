import { SchoolFinancialCharge } from '../../domain/entities/school-financial-charge';

export interface SchoolFinancialChargeRepository {
    findById(id: string): Promise<SchoolFinancialCharge | null>;
    save(charge: SchoolFinancialCharge): Promise<void>;
}

