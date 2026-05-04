import { SchoolRepository } from '../../ports/repositories/school.repo';
import { type PostalAddressProps } from '../../domain/value-objects/postal-address';

type SchoolSummary = {
    id: string;
    name: string;
    email: string;
    phone: string;
    cnpj: string | null;
    addresses: PostalAddressProps[];
    createdAt: Date;
    ownerName: string | null;
    ownerCpf: string | null;
    ownerEmail: string | null;
    ownerWhatsapp: string | null;
    incomeValue: number;
};

export class ListSchools {
    constructor(private readonly schools: SchoolRepository) {}

    async exec(): Promise<SchoolSummary[]> {
        const list = await this.schools.findAll();
        return list.map((school) => ({
            id: school.id,
            name: school.name,
            email: school.email,
            phone: school.phone,
            cnpj: school.cnpj,
            addresses: school.addresses.map((address) => address.toPrimitives()),
            createdAt: school.createdAt,
            ownerName: school.ownerName,
            ownerCpf: school.ownerCpf,
            ownerEmail: school.ownerEmail,
            ownerWhatsapp: school.ownerWhatsapp,
            incomeValue: school.incomeValue
        }));
    }
}
