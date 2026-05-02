import { AppDataSource } from './datasource';
import { SchoolWithdrawalRepository, ListSchoolWithdrawalsFilters } from '../../../ports/repositories/school-withdrawal.repo';
import { SchoolWithdrawal, SchoolWithdrawalStatus } from '../../../domain/entities/school-withdrawal';
import { SchoolWithdrawalOrm } from './entities/school-withdrawal.orm';

export class SchoolWithdrawalRepositoryAdapter implements SchoolWithdrawalRepository {
    private readonly repo = AppDataSource.getRepository(SchoolWithdrawalOrm);

    async findById(id: string): Promise<SchoolWithdrawal | null> {
        const row = await this.repo.findOne({ where: { id } });
        return row ? this.toDomain(row) : null;
    }

    async findByProviderRef(providerRef: string): Promise<SchoolWithdrawal | null> {
        const normalized = providerRef?.trim();
        if (!normalized) return null;
        const row = await this.repo.findOne({ where: { providerRef: normalized } });
        return row ? this.toDomain(row) : null;
    }

    async findBySchoolId(schoolId: string, filters?: ListSchoolWithdrawalsFilters): Promise<SchoolWithdrawal[]> {
        const queryBuilder = this.repo
            .createQueryBuilder('withdrawal')
            .where('withdrawal.schoolId = :schoolId', { schoolId })
            .orderBy('withdrawal.createdAt', 'DESC');

        if (filters?.month && filters?.year) {
            queryBuilder
                .andWhere('YEAR(withdrawal.createdAt) = :year', { year: filters.year })
                .andWhere('MONTH(withdrawal.createdAt) = :month', { month: filters.month });
        }

        const rows = await queryBuilder.getMany();
        return rows.map((row) => this.toDomain(row));
    }

    async save(withdrawal: SchoolWithdrawal): Promise<void> {
        const row = this.toOrm(withdrawal);
        await this.repo.save(row);
    }

    private toDomain(row: SchoolWithdrawalOrm): SchoolWithdrawal {
        return SchoolWithdrawal.restore({
            id: row.id,
            schoolId: row.schoolId,
            amountCents: row.amountCents,
            bankName: row.bankName,
            bankAgency: row.bankAgency,
            bankAccount: row.bankAccount,
            pixKey: row.pixKey,
            status: row.status as SchoolWithdrawalStatus,
            processedAt: row.processedAt,
            cancelledAt: row.cancelledAt,
            createdAt: row.createdAt,
            updatedAt: row.updatedAt,
            providerRef: row.providerRef ?? null,
            failureReason: row.failureReason ?? null
        });
    }

    private toOrm(withdrawal: SchoolWithdrawal): SchoolWithdrawalOrm {
        const row = this.repo.create({
            id: withdrawal.id,
            schoolId: withdrawal.schoolId,
            amountCents: withdrawal.amountCents,
            bankName: withdrawal.bankName,
            bankAgency: withdrawal.bankAgency,
            bankAccount: withdrawal.bankAccount,
            pixKey: withdrawal.pixKey,
            status: withdrawal.status,
            processedAt: withdrawal.processedAt,
            cancelledAt: withdrawal.cancelledAt,
            createdAt: withdrawal.createdAt,
            updatedAt: withdrawal.updatedAt,
            providerRef: withdrawal.providerRef,
            failureReason: withdrawal.failureReason
        });
        return row;
    }
}

