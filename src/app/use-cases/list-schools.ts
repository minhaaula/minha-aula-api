import { SchoolRepository } from '../../ports/repositories/school.repo';
import { type PostalAddressProps } from '../../domain/value-objects/postal-address';

type SchoolSummary = {
    id: string;
    name: string;
    addresses: PostalAddressProps[];
    createdAt: Date;
};

export class ListSchools {
    constructor(private readonly schools: SchoolRepository) {}

    async exec(): Promise<SchoolSummary[]> {
        const list = await this.schools.findAll();
        return list.map((school) => ({
            id: school.id,
            name: school.name,
            addresses: school.addresses.map((address) => address.toPrimitives()),
            createdAt: school.createdAt
        }));
    }
}
