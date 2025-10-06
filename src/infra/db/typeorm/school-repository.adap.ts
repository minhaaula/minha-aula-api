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
        const row = await this.repo.findOne({ where: { id }, relations: { addresses: true } });
        return row ? this.toDomain(row) : null;
    }

    async findAll(): Promise<School[]> {
        const rows = await this.repo.find({
            relations: { addresses: true },
            order: { createdAt: 'DESC' }
        });
        return rows.map((row) => this.toDomain(row));
    }

    async save(school: School): Promise<void> {
        await this.repo.save(this.toOrm(school));
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
            cnpj: row.cnpj
        });
    }

    private toOrm(school: School): SchoolOrm {
        const row = new SchoolOrm();
        row.id = school.id;
        row.name = school.name;
        row.createdAt = school.createdAt;
        row.email = school.email;
        row.phone = school.phone;
        row.cnpj = school.cnpj;
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
            return item;
        });
        return row;
    }
}
