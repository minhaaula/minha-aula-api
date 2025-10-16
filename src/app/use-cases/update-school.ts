import { SchoolRepository } from '../../ports/repositories/school.repo';
import { PostalAddress, type PostalAddressProps } from '../../domain/value-objects/postal-address';
import { School } from '../../domain/entities/school';
import { PasswordHasherPort } from '../../ports/providers/password-hasher.port';

export class UpdateSchool {
    constructor(
        private readonly schools: SchoolRepository,
        private readonly passwordHasher: PasswordHasherPort
    ) {}

    async exec(input: {
        schoolId: string;
        name?: string;
        email?: string;
        phone?: string;
        cnpj?: string;
        addresses?: Array<{
            street: string;
            number: string;
            complement?: string | null;
            district?: string | null;
            city: string;
            state: string;
            zipCode: string;
        }>;
        ownerName?: string | null;
        ownerCpf?: string | null;
        ownerEmail?: string | null;
        ownerUserId?: string | null;
        ownerPassword?: string | null;
        incomeValue?: number;
    }): Promise<{
        id: string;
        name: string;
        email: string;
        phone: string;
        cnpj: string;
        addresses: PostalAddressProps[];
        createdAt: Date;
        ownerUserId: string | null;
        ownerName: string | null;
        ownerCpf: string | null;
        ownerEmail: string | null;
        incomeValue: number;
    }> {
        const schoolId = input.schoolId.trim();
        if (!schoolId) {
            throw new Error('School id is required');
        }

        const school = await this.schools.findById(schoolId);
        if (!school) {
            throw new Error('School not found');
        }

        const name = typeof input.name === 'string' ? input.name : school.name;
        const email = typeof input.email === 'string' ? input.email : school.email;
        const phone = typeof input.phone === 'string' ? input.phone : school.phone;
        const cnpj = typeof input.cnpj === 'string' ? input.cnpj : school.cnpj;

        const addresses = input.addresses
            ? input.addresses.map((address) => PostalAddress.create({
                street: address.street,
                number: address.number,
                complement: address.complement ?? null,
                district: address.district ?? null,
                city: address.city,
                state: address.state,
                zipCode: address.zipCode
            }))
            : school.addresses;

        const ownerName = input.ownerName !== undefined ? input.ownerName : school.ownerName;
        const ownerCpf = input.ownerCpf !== undefined ? input.ownerCpf : school.ownerCpf;
        const ownerEmail = input.ownerEmail !== undefined ? input.ownerEmail : school.ownerEmail;
        let ownerUserId = input.ownerUserId !== undefined ? input.ownerUserId : school.ownerUserId;

        let ownerPasswordHash = school.ownerPasswordHash;
        if (input.ownerPassword !== undefined) {
            if (input.ownerPassword === null) {
                ownerPasswordHash = null;
            } else {
                ownerPasswordHash = await this.passwordHasher.hash(input.ownerPassword);
            }
        }

        const incomeValue = input.incomeValue !== undefined ? input.incomeValue : school.incomeValue;

        const ownerFields = [ownerName ?? null, ownerCpf ?? null, ownerEmail ?? null];
        const ownerInfoProvided = ownerFields.some((value) => value !== null);
        if (ownerInfoProvided) {
            if (ownerFields.some((value) => value === null)) {
                throw new Error('School owner information is incomplete');
            }
            if (!ownerPasswordHash) {
                throw new Error('School owner password is required');
            }
        } else {
            ownerPasswordHash = null;
            ownerUserId = null;
        }

        const updated = School.create({
            id: school.id,
            name,
            email,
            phone,
            cnpj,
            addresses,
            ownerUserId,
            ownerName,
            ownerCpf,
            ownerEmail,
            ownerPasswordHash,
            createdAt: school.createdAt,
            accountId: school.accountId,
            incomeValue
        });

        await this.schools.save(updated);

        return {
            id: updated.id,
            name: updated.name,
            email: updated.email,
            phone: updated.phone,
            cnpj: updated.cnpj,
            addresses: updated.addresses.map((address) => address.toPrimitives()),
            createdAt: updated.createdAt,
            ownerUserId: updated.ownerUserId,
            ownerName: updated.ownerName,
            ownerCpf: updated.ownerCpf,
            ownerEmail: updated.ownerEmail,
            incomeValue: updated.incomeValue
        };
    }
}
