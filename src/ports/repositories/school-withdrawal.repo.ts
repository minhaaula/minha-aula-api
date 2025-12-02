import { SchoolWithdrawal, SchoolWithdrawalStatus } from '../../domain/entities/school-withdrawal';

export interface ListSchoolWithdrawalsFilters {
    month?: number;
    year?: number;
}

export interface SchoolWithdrawalRepository {
    findById(id: string): Promise<SchoolWithdrawal | null>;
    findBySchoolId(schoolId: string, filters?: ListSchoolWithdrawalsFilters): Promise<SchoolWithdrawal[]>;
    save(withdrawal: SchoolWithdrawal): Promise<void>;
}

