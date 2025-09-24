import { UserRepository } from '../../ports/repositories/user.repo';
import { PasswordHasherPort } from '../../ports/providers/password-hasher.port';
import { Email } from '../../domain/value-objects/email';
import { User } from '../../domain/entities/user';
import { Uuid } from '../../shared/uuid';

type RegisterInput = {
    fullName: string;
    birthDate: string;
    email: string;
    phone: string;
    cpf: string;
    address: string;
    password: string;
};

export class RegisterUser {
    constructor(
        private readonly users: UserRepository,
        private readonly hasher: PasswordHasherPort
    ) {}

    async exec(input: RegisterInput): Promise<{ userId: string; fullName: string; email: string; cpf: string; createdAt: Date; }> {
        const email = Email.create(input.email);

        const existingByEmail = await this.users.findByEmail(email.value);
        if (existingByEmail) throw new Error('Email already registered');

        const cpf = this.normalizeCpf(input.cpf);
        const existingByCpf = await this.users.findByCpf(cpf);
        if (existingByCpf) throw new Error('CPF already registered');

        const birthDate = new Date(input.birthDate);
        if (Number.isNaN(birthDate.getTime())) throw new Error('Invalid birth date');

        const passwordHash = await this.hasher.hash(input.password);
        const user = User.create({
            id: Uuid(),
            fullName: input.fullName,
            birthDate,
            email,
            phone: input.phone,
            cpf,
            address: input.address,
            passwordHash
        });

        await this.users.save(user);

        return {
            userId: user.id,
            fullName: user.fullName,
            email: user.email.value,
            cpf: user.cpf,
            createdAt: user.createdAt
        };
    }

    private normalizeCpf(value: string) {
        const digits = value.replace(/\D/g, '');
        if (digits.length !== 11) throw new Error('Invalid CPF');
        return digits;
    }
}
