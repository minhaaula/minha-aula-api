import { AppDataSource } from './datasource';
import { SchoolBankAccountRepository } from '../../../ports/repositories/school-bank-account.repo';
import { SchoolBankAccount } from '../../../domain/entities/school-bank-account';
import { SchoolBankAccountOrm } from './entities/school-bank-account.orm';

export class SchoolBankAccountRepositoryAdapter implements SchoolBankAccountRepository {
    private readonly repo = AppDataSource.getRepository(SchoolBankAccountOrm);

    async findById(id: string): Promise<SchoolBankAccount | null> {
        const normalized = id.trim();
        if (!normalized) return null;
        const row = await this.repo.findOne({ where: { id: normalized } });
        return row ? this.toDomain(row) : null;
    }

    async findBySchoolId(schoolId: string): Promise<SchoolBankAccount[]> {
        const normalized = schoolId.trim();
        if (!normalized) return [];
        const rows = await this.repo.find({
            where: { schoolId: normalized },
            order: { createdAt: 'DESC' }
        });
        return rows.map((row) => this.toDomain(row));
    }

    async findBySchoolIdAndActive(schoolId: string): Promise<SchoolBankAccount[]> {
        const normalized = schoolId.trim();
        if (!normalized) return [];
        const rows = await this.repo.find({
            where: { schoolId: normalized, isActive: 1 },
            order: { createdAt: 'DESC' }
        });
        return rows.map((row) => this.toDomain(row));
    }

    async save(account: SchoolBankAccount): Promise<void> {
        const row = await this.toOrm(account);
        await this.repo.save(row);
    }

    async delete(id: string): Promise<void> {
        await this.repo.delete(id);
    }

    private toDomain(row: SchoolBankAccountOrm): SchoolBankAccount {
        return SchoolBankAccount.create({
            id: row.id,
            schoolId: row.schoolId,
            bankName: row.bankName,
            bankCode: row.bankCode ?? undefined,
            bankAgency: row.bankAgency,
            bankAgencyDigit: row.bankAgencyDigit ?? undefined,
            bankAccount: row.bankAccount,
            bankAccountDigit: row.bankAccountDigit ?? undefined,
            bankAccountType: row.bankAccountType,
            bankAccountHolderDocument: row.bankAccountHolderDocument,
            pixKey: row.pixKey ?? undefined,
            isActive: row.isActive === 1,
            createdAt: row.createdAt,
            updatedAt: row.updatedAt
        });
    }

    private async toOrm(account: SchoolBankAccount): Promise<SchoolBankAccountOrm> {
        const existing = await this.repo.findOne({ where: { id: account.id } });
        const row = existing ?? new SchoolBankAccountOrm();
        row.id = account.id;
        row.schoolId = account.schoolId;
        row.bankName = account.bankName;
        row.bankCode = account.bankCode ?? null;
        row.bankAgency = account.bankAgency;
        row.bankAgencyDigit = account.bankAgencyDigit ?? null;
        row.bankAccount = account.bankAccount;
        row.bankAccountDigit = account.bankAccountDigit ?? null;
        row.bankAccountType = account.bankAccountType;
        row.bankAccountHolderDocument = account.bankAccountHolderDocument;
        row.pixKey = account.pixKey ?? null;
        row.isActive = account.isActive ? 1 : 0;
        row.createdAt = account.createdAt;
        row.updatedAt = account.updatedAt;
        return row;
    }
}

