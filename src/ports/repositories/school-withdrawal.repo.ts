import { SchoolWithdrawal, SchoolWithdrawalStatus } from '../../domain/entities/school-withdrawal';

export interface ListSchoolWithdrawalsFilters {
    month?: number;
    year?: number;
}

export interface SchoolWithdrawalRepository {
    findById(id: string): Promise<SchoolWithdrawal | null>;
    findBySchoolId(schoolId: string, filters?: ListSchoolWithdrawalsFilters): Promise<SchoolWithdrawal[]>;
    /** Localiza saque pelo id da transferência no Asaas (usado pelo webhook /transfers). */
    findByProviderRef?(providerRef: string): Promise<SchoolWithdrawal | null>;
    save(withdrawal: SchoolWithdrawal): Promise<void>;
}

// `SchoolWithdrawalStatus` é re-exportado para uso em adapters/use-cases.
export type { SchoolWithdrawalStatus };

