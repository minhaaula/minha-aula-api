import { PostalAddress } from '../value-objects/postal-address';
import { Email } from '../value-objects/email';

export class School {
    private constructor(
        public readonly id: string,
        public readonly name: string,
        private readonly _addresses: PostalAddress[],
        public readonly createdAt: Date,
        private readonly _email: Email,
        private readonly _phone: string,
        private readonly _cnpj: string
    ) {}

    static create(params: { id: string; name: string; email: string; phone: string; cnpj: string; addresses?: PostalAddress[]; createdAt?: Date; }) {
        const name = params.name.trim();
        if (!name) throw new Error('School name is required');

        const addresses = params.addresses ?? [];
        if (!Array.isArray(addresses)) throw new Error('School addresses must be an array');
        for (const address of addresses) {
            if (!(address instanceof PostalAddress)) {
                throw new Error('Invalid school address');
            }
        }

        const email = Email.create(params.email);
        const phone = School.normalizePhone(params.phone);
        const cnpj = School.normalizeCnpj(params.cnpj);

        return new School(params.id, name, [...addresses], params.createdAt ?? new Date(), email, phone, cnpj);
    }

    get addresses(): PostalAddress[] {
        return [...this._addresses];
    }

    get email(): string {
        return this._email.value;
    }

    get phone(): string {
        return this._phone;
    }

    get cnpj(): string {
        return this._cnpj;
    }

    private static normalizePhone(value: string) {
        const digits = value.replace(/\D/g, '');
        if (digits.length < 10 || digits.length > 15) {
            throw new Error('Invalid school phone');
        }
        return digits;
    }

    private static normalizeCnpj(value: string) {
        const digits = value.replace(/\D/g, '');
        if (digits.length !== 14) {
            throw new Error('Invalid school CNPJ');
        }
        return digits;
    }
}
