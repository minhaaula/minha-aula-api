import { Email } from '../value-objects/email';

export class User {
    private constructor(
        public readonly id: string,
        public readonly fullName: string,
        public readonly birthDate: Date,
        public readonly email: Email,
        public readonly phone: string,
        public readonly cpf: string,
        public readonly address: string,
        private _passwordHash: string,
        public readonly createdAt: Date
    ) {}

    static create(params: {
        id: string;
        fullName: string;
        birthDate: Date;
        email: Email;
        phone: string;
        cpf: string;
        address: string;
        passwordHash: string;
        createdAt?: Date;
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
        const address = params.address.trim();
        if (!address) throw new Error('Address is required');
        return new User(
            params.id,
            fullName,
            params.birthDate,
            params.email,
            phone,
            cpf,
            address,
            params.passwordHash,
            params.createdAt ?? new Date()
        );
    }

    get passwordHash() {
        return this._passwordHash;
    }

    setPasswordHash(hash: string) {
        this._passwordHash = hash;
    }
}
