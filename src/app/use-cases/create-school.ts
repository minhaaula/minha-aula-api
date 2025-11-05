import { SchoolRepository } from '../../ports/repositories/school.repo';
import { School } from '../../domain/entities/school';
import { Uuid } from '../../shared/uuid';
import { PostalAddress, type PostalAddressProps } from '../../domain/value-objects/postal-address';
import { PasswordHasherPort } from '../../ports/providers/password-hasher.port';
import type { CreateSchoolInput, CreateSchoolOutput } from '../types/school.types';

export class CreateSchool {
    constructor(
        private readonly schools: SchoolRepository,
        private readonly passwordHasher: PasswordHasherPort
    ) {}

    async exec(input: CreateSchoolInput): Promise<CreateSchoolOutput> {
        const addresses = (input.addresses ?? []).map((address) => PostalAddress.create({
            street: address.street,
            number: address.number,
            complement: address.complement ?? null,
            district: address.district ?? null,
            city: address.city,
            state: address.state,
            zipCode: address.zipCode
        }));

        const ownerFieldsProvided = [input.ownerName, input.ownerCpf, input.ownerEmail, input.ownerPassword]
            .some((value) => value !== undefined && value !== null);
        if (ownerFieldsProvided) {
            if (!input.ownerName || !input.ownerCpf || !input.ownerEmail || !input.ownerPassword) {
                throw new Error('School owner information is incomplete');
            }
        }

        const ownerPasswordHash = input.ownerPassword
            ? await this.passwordHasher.hash(input.ownerPassword)
            : null;

        const school = School.create({
            id: Uuid(),
            name: input.name,
            addresses,
            email: input.email,
            phone: input.phone,
            cnpj: input.cnpj,
            ownerUserId: input.ownerUserId ?? null,
            ownerName: input.ownerName ?? null,
            ownerCpf: input.ownerCpf ?? null,
            ownerEmail: input.ownerEmail ?? null,
            ownerPasswordHash,
            incomeValue: input.incomeValue
        });
        await this.schools.save(school);
        return {
            id: school.id,
            name: school.name,
            email: school.email,
            phone: school.phone,
            cnpj: school.cnpj,
            addresses: school.addresses.map((address) => address.toPrimitives()),
            createdAt: school.createdAt,
            ownerUserId: school.ownerUserId,
            ownerName: school.ownerName,
            ownerCpf: school.ownerCpf,
            ownerEmail: school.ownerEmail,
            incomeValue: school.incomeValue
        };
    }
}
