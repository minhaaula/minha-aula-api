import { Between } from 'typeorm';
import { AppDataSource } from './datasource';
import { SchoolRepository } from '../../../ports/repositories/school.repo';
import { School } from '../../../domain/entities/school';
import { SchoolOrm } from './entities/school.orm';
import { PostalAddress } from '../../../domain/value-objects/postal-address';
import { SchoolAddressOrm } from './entities/school-address.orm';
import { Uuid } from '../../../shared/uuid';
export class SchoolRepositoryAdapter implements SchoolRepository {
    private readonly repo = AppDataSource.getRepository(SchoolOrm);

    async findById(id: string): Promise<School | null> {
        const row = await this.repo.findOne({
            where: { id },
            relations: {
                addresses: true
            }
        });
        return row ? this.toDomain(row) : null;
    }

    async findByEmail(email: string): Promise<School | null> {
        const normalized = email.trim().toLowerCase();
        if (!normalized) return null;
        const row = await this.repo.findOne({
            where: { email: normalized },
            relations: {
                addresses: true
            }
        });
        return row ? this.toDomain(row) : null;
    }

    async findByCnpj(cnpj: string): Promise<School | null> {
        const digits = cnpj.replace(/\D/g, '');
        if (digits.length !== 14) return null;
        const row = await this.repo.findOne({
            where: { cnpj: digits },
            relations: {
                addresses: true
            }
        });
        return row ? this.toDomain(row) : null;
    }

    async findByOwnerUserId(userId: string): Promise<School | null> {
        const normalized = userId.trim();
        if (!normalized) return null;
        const row = await this.repo.findOne({
            where: { ownerUserId: normalized },
            relations: {
                addresses: true
            }
        });
        return row ? this.toDomain(row) : null;
    }

    async findByOwnerEmail(email: string): Promise<School | null> {
        const normalized = email.trim().toLowerCase();
        if (!normalized) return null;
        const row = await this.repo.findOne({
            where: { ownerEmail: normalized },
            relations: {
                addresses: true
            }
        });
        return row ? this.toDomain(row) : null;
    }

    async findByAccountId(accountId: string): Promise<School | null> {
        const normalized = accountId?.trim();
        if (!normalized) return null;
        const row = await this.repo.findOne({
            where: { accountId: normalized },
            relations: {
                addresses: true
            }
        });
        return row ? this.toDomain(row) : null;
    }

    async findAll(): Promise<School[]> {
        const rows = await this.repo.find({
            relations: {
                addresses: true
            },
            order: { createdAt: 'DESC' }
        });
        return rows.map((row) => this.toDomain(row));
    }

    async findWithAccountKeyWithoutOnboardingUrl(limit = 50): Promise<School[]> {
        const qb = this.repo
            .createQueryBuilder('s')
            .leftJoinAndSelect('s.addresses', 'addresses')
            .where('s.accountApiKey IS NOT NULL')
            .andWhere('(s.onboardingUrl IS NULL OR s.onboardingUrl = :empty)', { empty: '' })
            .orderBy('s.createdAt', 'DESC')
            .take(limit);
        const rows = await qb.getMany();
        return rows.map((row) => this.toDomain(row));
    }

    async save(school: School): Promise<void> {
        const row = await this.toOrm(school);
        await this.repo.save(row);
    }

    async updateOwnerPassword(schoolId: string, hashedPassword: string): Promise<void> {
        await this.repo.update(schoolId, { ownerPasswordHash: hashedPassword });
    }

    private toDomain(row: SchoolOrm): School {
        const addresses = (row.addresses ?? []).map((address) => PostalAddress.create({
            street: address.street,
            number: address.number,
            complement: address.complement,
            district: address.district,
            city: address.city,
            state: address.state,
            zipCode: address.zipCode
        }));

        return School.create({
            id: row.id,
            name: row.name,
            addresses,
            createdAt: row.createdAt,
            email: row.email,
            phone: row.phone,
            cnpj: row.cnpj ?? null,
            ownerUserId: row.ownerUserId ?? null,
            ownerName: row.ownerName ?? null,
            ownerCpf: row.ownerCpf ?? null,
            ownerEmail: row.ownerEmail ?? null,
            ownerBirthDate: row.ownerBirthDate ?? null,
            ownerWhatsapp: row.ownerWhatsapp ?? null,
            ownerPasswordHash: row.ownerPasswordHash ?? null,
            accountId: row.accountId ?? null,
            accountApiKey: row.accountApiKey ?? null,
            walletId: row.walletId ?? null,
            onboardingUrl: row.onboardingUrl ?? null,
            incomeValue: typeof row.incomeValue === 'number' ? row.incomeValue : 5000,
            facebookLink: row.facebookLink ?? null,
            instagramLink: row.instagramLink ?? null,
            tiktokLink: row.tiktokLink ?? null,
            youtubeLink: row.youtubeLink ?? null,
            siteLink: row.siteLink ?? null,
            onboardingCompletedAt: row.onboardingCompletedAt ?? null,
            notificationsEmailEnabled: row.notificationsEmailEnabled ?? true,
            notificationsWhatsappEnabled: row.notificationsWhatsappEnabled ?? true,
            notificationsPushEnabled: row.notificationsPushEnabled ?? true,
            accountStatusSnapshot: (row.accountStatusSnapshot ?? null) as Record<string, unknown> | null
        });
    }

    private async toOrm(school: School): Promise<SchoolOrm> {
        const existing = await this.repo.findOne({
            where: { id: school.id },
            relations: {
                addresses: true
            }
        });

        const row = existing ?? new SchoolOrm();
        row.id = school.id;
        row.name = school.name;
        row.createdAt = school.createdAt;
        row.email = school.email;
        row.phone = school.phone;
        row.cnpj = school.cnpj;
        row.ownerUserId = school.ownerUserId;
        row.ownerName = school.ownerName;
        row.ownerCpf = school.ownerCpf;
        row.ownerEmail = school.ownerEmail;
        row.ownerBirthDate = school.ownerBirthDate;
        row.ownerWhatsapp = school.ownerWhatsapp;
        row.ownerPasswordHash = school.ownerPasswordHash;
        row.accountId = school.accountId;
        row.accountApiKey = school.accountApiKey;
        row.walletId = school.walletId;
        row.onboardingUrl = school.onboardingUrl;
        row.incomeValue = school.incomeValue;
        row.facebookLink = school.facebookLink;
        row.instagramLink = school.instagramLink;
        row.tiktokLink = school.tiktokLink;
        row.youtubeLink = school.youtubeLink;
        row.siteLink = school.siteLink;
        row.onboardingCompletedAt = school.onboardingCompletedAt;
        row.notificationsEmailEnabled = school.notificationsEmailEnabled;
        row.notificationsWhatsappEnabled = school.notificationsWhatsappEnabled;
        row.notificationsPushEnabled = school.notificationsPushEnabled;
        row.accountStatusSnapshot = school.accountStatusSnapshot as Record<string, unknown> | null;
        if (existing) {
            await this.repo.manager.createQueryBuilder()
                .delete()
                .from(SchoolAddressOrm)
                .where('school_id = :id', { id: school.id })
                .execute();
        }

        row.addresses = school.addresses.map((address) => {
            const item = new SchoolAddressOrm();
            item.id = Uuid();
            item.street = address.street;
            item.number = address.number;
            item.complement = address.complement;
            item.district = address.district;
            item.city = address.city;
            item.state = address.state;
            item.zipCode = address.zipCode;
            item.school = row;
            (item as any).schoolId = row.id;
            return item;
        });
        return row;
    }

    async countCreatedBefore(date: Date): Promise<number> {
        return this.repo.count({
            where: { createdAt: Between(new Date(0), date) }
        });
    }

    async findLatestCreated(limit: number): Promise<Array<{ id: string; name: string; city: string | null; createdAt: Date }>> {
        const rows = await AppDataSource.query(
            `SELECT s.id AS id, s.name AS name, s.created_at AS createdAt,
                    (SELECT city FROM school_addresses WHERE school_id = s.id LIMIT 1) AS city
             FROM schools s
             ORDER BY s.created_at DESC
             LIMIT ?`,
            [limit]
        );
        return rows.map((r: any) => ({
            id: r.id,
            name: r.name,
            city: r.city ?? null,
            createdAt: new Date(r.createdAt)
        }));
    }

    async findCitiesBySchoolIds(schoolIds: string[]): Promise<import('../../../ports/repositories/school.repo').SchoolCityInfo[]> {
        if (schoolIds.length === 0) return [];

        const results = await AppDataSource.query(`
            SELECT 
                school_id,
                MIN(city) AS city
            FROM school_addresses
            WHERE school_id IN (${schoolIds.map(() => '?').join(',')})
            GROUP BY school_id
        `, schoolIds);

        return results.map((row: any) => ({
            schoolId: row.school_id,
            city: row.city || null
        }));
    }
}


