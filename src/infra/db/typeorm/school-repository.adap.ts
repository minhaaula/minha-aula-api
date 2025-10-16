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

    async findAll(): Promise<School[]> {
        const rows = await this.repo.find({
            relations: {
                addresses: true
            },
            order: { createdAt: 'DESC' }
        });
        return rows.map((row) => this.toDomain(row));
    }

    async save(school: School): Promise<void> {
        const row = await this.toOrm(school);
        await this.repo.save(row);
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
            cnpj: row.cnpj,
            ownerUserId: row.ownerUserId ?? null,
            ownerName: row.ownerName ?? null,
            ownerCpf: row.ownerCpf ?? null,
            ownerEmail: row.ownerEmail ?? null,
            ownerPasswordHash: row.ownerPasswordHash ?? null,
            accountId: row.accountId ?? null,
            incomeValue: typeof row.incomeValue === 'number' ? row.incomeValue : 5000
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
        row.ownerPasswordHash = school.ownerPasswordHash;
        row.accountId = school.accountId;
        row.incomeValue = school.incomeValue;
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
}
