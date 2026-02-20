import { Email } from '../value-objects/email';
import { PostalAddress } from '../value-objects/postal-address';
import { UserPersona, assertUserPersona } from '../value-objects/user-persona';

export class User {
    private constructor(
        public readonly id: string,
        public readonly fullName: string,
        public readonly birthDate: Date,
        public readonly email: Email,
        public readonly phone: string,
        public readonly cpf: string,
        public readonly address: PostalAddress,
        public readonly persona: UserPersona,
        private _passwordHash: string,
        public readonly createdAt: Date,
        public readonly active: boolean,
        public readonly deactivationReason: string | null,
        public readonly deactivationDescription: string | null
    ) {}

    static create(params: {
        id: string;
        fullName: string;
        birthDate: Date;
        email: Email;
        phone: string;
        cpf: string;
        address: PostalAddress;
        persona: string;
        passwordHash: string;
        createdAt?: Date;
        active?: boolean;
        deactivationReason?: string | null;
        deactivationDescription?: string | null;
    }) {
        if (!(params.birthDate instanceof Date) || Number.isNaN(params.birthDate.getTime())) {
            throw new Error('Invalid birth date');
        }
        const fullName = params.fullName.trim();
        if (!fullName) throw new Error('Full name is required');
        const phone = params.phone.trim();
        if (!phone) throw new Error('Phone is required');
        const cpf = params.cpf.replace(/\D/g, '');
        if (cpf.length !== 11) throw new Error('Invalid CPF');
        if (!(params.address instanceof PostalAddress)) {
            throw new Error('Address is required');
        }
        assertUserPersona(params.persona);

        return new User(
            params.id,
            fullName,
            params.birthDate,
            params.email,
            phone,
            cpf,
            params.address,
            params.persona,
            params.passwordHash,
            params.createdAt ?? new Date(),
            params.active ?? true,
            params.deactivationReason ?? null,
            params.deactivationDescription ?? null
        );
    }

    get passwordHash() {
        return this._passwordHash;
    }

    setPasswordHash(hash: string) {
        this._passwordHash = hash;
    }
}
