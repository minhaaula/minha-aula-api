import { SchoolRepository } from '../../ports/repositories/school.repo';
import { School } from '../../domain/entities/school';
import { Uuid } from '../../shared/uuid';
import { PostalAddress, type PostalAddressProps } from '../../domain/value-objects/postal-address';

export class CreateSchool {
    constructor(private readonly schools: SchoolRepository) {}

    async exec(input: {
        name: string;
        addresses?: Array<{
            street: string;
            number: string;
            complement?: string | null;
            district?: string | null;
            city: string;
            state: string;
            zipCode: string;
        }>;
    }): Promise<{ id: string; name: string; addresses: PostalAddressProps[]; createdAt: Date; }> {
        const addresses = (input.addresses ?? []).map((address) => PostalAddress.create({
            street: address.street,
            number: address.number,
            complement: address.complement ?? null,
            district: address.district ?? null,
            city: address.city,
            state: address.state,
            zipCode: address.zipCode
        }));

        const school = School.create({ id: Uuid(), name: input.name, addresses });
        await this.schools.save(school);
        return {
            id: school.id,
            name: school.name,
            addresses: school.addresses.map((address) => address.toPrimitives()),
            createdAt: school.createdAt
        };
    }
}
