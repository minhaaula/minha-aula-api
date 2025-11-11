import { SchoolBankAccount } from '../../domain/entities/school-bank-account';

export interface SchoolBankAccountRepository {
    findById(id: string): Promise<SchoolBankAccount | null>;
    findBySchoolId(schoolId: string): Promise<SchoolBankAccount[]>;
    findBySchoolIdAndActive(schoolId: string): Promise<SchoolBankAccount[]>;
    save(account: SchoolBankAccount): Promise<void>;
    delete(id: string): Promise<void>;
}

