import { UserRepository } from '../../ports/repositories/user.repo';
import { PasswordHasherPort } from '../../ports/providers/password-hasher.port';
import { Email } from '../../domain/value-objects/email';
import { User } from '../../domain/entities/user';
import { Uuid } from '../../shared/uuid';
import { PostalAddress } from '../../domain/value-objects/postal-address';
import { UserPersona, assertUserPersona } from '../../domain/value-objects/user-persona';
import { AppError, ErrorCode } from '../../shared/errors';

type RegisterInput = {
    fullName: string;
    birthDate: string;
    email: string;
    phone: string;
    cpf: string;
    address: {
        street: string;
        number: string;
        complement?: string | null;
        district?: string | null;
        city: string;
        state: string;
        zipCode: string;
    };
    persona: UserPersona;
    password: string;
};

export class RegisterUser {
    constructor(
        private readonly users: UserRepository,
        private readonly hasher: PasswordHasherPort
    ) {}

    async exec(input: RegisterInput): Promise<{ userId: string; fullName: string; email: string; cpf: string; persona: UserPersona; createdAt: Date; }> {
        const email = Email.create(input.email);

        const existingByEmail = await this.users.findByEmail(email.value);
        if (existingByEmail) {
            throw AppError.fromCode(ErrorCode.EMAIL_ALREADY_REGISTERED, { email: email.value });
        }

        const cpf = this.normalizeCpf(input.cpf);
        const existingByCpf = await this.users.findByCpf(cpf);
        if (existingByCpf) {
            throw AppError.fromCode(ErrorCode.CPF_ALREADY_REGISTERED, { cpf });
        }

        const birthDate = new Date(input.birthDate);
        if (Number.isNaN(birthDate.getTime())) {
            throw AppError.fromCode(ErrorCode.INVALID_BIRTH_DATE, { birthDate: input.birthDate });
        }

        assertUserPersona(input.persona);

        const address = PostalAddress.create({
            street: input.address.street,
            number: input.address.number,
            complement: input.address.complement ?? null,
            district: input.address.district ?? null,
            city: input.address.city,
            state: input.address.state,
            zipCode: input.address.zipCode
        });

        const passwordHash = await this.hasher.hash(input.password);
        const user = User.create({
            id: Uuid(),
            fullName: input.fullName,
            birthDate,
            email,
            phone: input.phone,
            cpf,
            address,
            persona: input.persona,
            passwordHash
        });

        await this.users.save(user);

        return {
            userId: user.id,
            fullName: user.fullName,
            email: user.email.value,
            cpf: user.cpf,
            persona: user.persona,
            createdAt: user.createdAt
        };
    }

    private normalizeCpf(value: string) {
        const digits = value.replace(/\D/g, '');
        if (digits.length !== 11) {
            throw AppError.fromCode(ErrorCode.INVALID_CPF, { cpf: value });
        }
        return digits;
    }
}
