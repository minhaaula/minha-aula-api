import { SchoolRepository } from '../../ports/repositories/school.repo';
import { PostalAddress, type PostalAddressProps } from '../../domain/value-objects/postal-address';
import { School } from '../../domain/entities/school';
import { PasswordHasherPort } from '../../ports/providers/password-hasher.port';
import { AppError, ErrorCode } from '../../shared/errors';
import type { UpdateSchoolInput, UpdateSchoolOutput } from '../types/school.types';

export class UpdateSchool {
    constructor(
        private readonly schools: SchoolRepository,
        private readonly passwordHasher: PasswordHasherPort
    ) {}

    async exec(input: UpdateSchoolInput): Promise<UpdateSchoolOutput> {
        const schoolId = input.schoolId.trim();
        if (!schoolId) {
            throw AppError.fromCode(ErrorCode.REQUIRED_FIELD, { field: 'schoolId' });
        }

        const school = await this.schools.findById(schoolId);
        if (!school) {
            throw AppError.fromCode(ErrorCode.SCHOOL_NOT_FOUND, { schoolId });
        }

        const name = typeof input.name === 'string' ? input.name : school.name;
        const email = typeof input.email === 'string' ? input.email : school.email;
        const phone = typeof input.phone === 'string' ? input.phone : school.phone;
        const cnpj = input.cnpj !== undefined ? input.cnpj : school.cnpj;

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
        const ownerWhatsapp =
            input.ownerWhatsapp !== undefined ? input.ownerWhatsapp : school.ownerWhatsapp;
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

        const facebookLink = input.links?.facebook !== undefined ? input.links.facebook : school.facebookLink;
        const instagramLink = input.links?.instagram !== undefined ? input.links.instagram : school.instagramLink;
        const tiktokLink = input.links?.tiktok !== undefined ? input.links.tiktok : school.tiktokLink;
        const youtubeLink = input.links?.youtube !== undefined ? input.links.youtube : school.youtubeLink;
        const siteLink = input.links?.site !== undefined ? input.links.site : school.siteLink;

        const ownerFields = [ownerName ?? null, ownerCpf ?? null, ownerEmail ?? null];
        const ownerInfoProvided = ownerFields.some((value) => value !== null);
        if (ownerInfoProvided) {
            if (ownerFields.some((value) => value === null)) {
                throw AppError.fromCode(ErrorCode.INCOMPLETE_DATA, { message: 'School owner information is incomplete' });
            }
            if (!ownerPasswordHash) {
                throw AppError.fromCode(ErrorCode.REQUIRED_FIELD, { field: 'ownerPassword' });
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
            ownerWhatsapp,
            ownerPasswordHash,
            createdAt: school.createdAt,
            accountId: school.accountId,
            accountApiKey: school.accountApiKey,
            walletId: school.walletId,
            incomeValue,
            facebookLink,
            instagramLink,
            tiktokLink,
            youtubeLink,
            siteLink
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
            ownerWhatsapp: updated.ownerWhatsapp,
            incomeValue: updated.incomeValue,
            links: {
                facebook: updated.facebookLink,
                instagram: updated.instagramLink,
                tiktok: updated.tiktokLink,
                youtube: updated.youtubeLink,
                site: updated.siteLink
            }
        };
    }
}
