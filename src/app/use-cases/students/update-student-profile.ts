import { UserRepository } from '../../../ports/repositories/user.repo';
import { Email } from '../../../domain/value-objects/email';
import { PostalAddress, PostalAddressProps } from '../../../domain/value-objects/postal-address';
import { User } from '../../../domain/entities/user';
import type { Gender } from '../../../domain/value-objects/gender';
import { parseGender } from '../../../domain/value-objects/gender';
import { AppError, ErrorCode } from '../../../shared/errors';

export interface UpdateStudentProfileInput {
    userId: string;
    fullName?: string;
    email?: string;
    phone?: string;
    address?: {
        street: string;
        number: string;
        complement?: string | null;
        district?: string | null;
        city: string;
        state: string;
        zipCode: string;
    };
    gender?: Gender | null;
}

export interface UpdateStudentProfileOutput {
    id: string;
    fullName: string;
    email: string;
    cpf: string;
    phone: string;
    birthDate: Date;
    address: PostalAddressProps;
    gender: Gender | null;
    createdAt: Date;
}

export class UpdateStudentProfile {
    constructor(
        private readonly users: UserRepository
    ) {}

    async exec(input: UpdateStudentProfileInput): Promise<UpdateStudentProfileOutput> {
        const userId = input.userId.trim();
        if (!userId) {
            throw new Error('User id is required');
        }

        const user = await this.users.findById(userId);
        if (!user) {
            throw new Error('User not found');
        }

        // Validar se o email já está em uso por outro usuário
        if (input.email) {
            const email = Email.create(input.email);
            const existingUser = await this.users.findByEmail(email.value);
            if (existingUser && existingUser.id !== userId) {
                throw new Error('Email already registered');
            }
        }

        const fullName = typeof input.fullName === 'string' ? input.fullName : user.fullName;
        const email = input.email ? Email.create(input.email) : user.email;
        const phone = typeof input.phone === 'string' ? input.phone : user.phone;
        const address = input.address
            ? PostalAddress.create({
                street: input.address.street,
                number: input.address.number,
                complement: input.address.complement ?? null,
                district: input.address.district ?? null,
                city: input.address.city,
                state: input.address.state,
                zipCode: input.address.zipCode
            })
            : user.address;

        const gender =
            input.gender !== undefined
                ? this.resolveGender(input.gender)
                : user.gender;

        const updated = User.create({
            id: user.id,
            fullName,
            birthDate: user.birthDate,
            email,
            phone,
            cpf: user.cpf,
            address,
            persona: user.persona,
            passwordHash: user.passwordHash,
            createdAt: user.createdAt,
            active: user.active,
            deactivationReason: user.deactivationReason,
            deactivationDescription: user.deactivationDescription,
            photoStorageKey: user.photoStorageKey,
            studentAccessEnabled: user.studentAccessEnabled,
            gender
        });

        await this.users.save(updated);

        return {
            id: updated.id,
            fullName: updated.fullName,
            email: updated.email.value,
            cpf: updated.cpf,
            phone: updated.phone,
            birthDate: updated.birthDate,
            address: updated.address.toPrimitives(),
            gender: updated.gender ?? null,
            createdAt: updated.createdAt
        };
    }

    private resolveGender(value: Gender | null): Gender | null {
        if (value === null) return null;
        const parsed = parseGender(value);
        if (!parsed) {
            throw AppError.fromCode(ErrorCode.VALIDATION_ERROR, {
                message: 'gender inválido (use MALE ou FEMALE)'
            });
        }
        return parsed;
    }
}

