import { PostalAddress } from '../value-objects/postal-address';

export class School {
    private constructor(
        public readonly id: string,
        public readonly name: string,
        private readonly _addresses: PostalAddress[],
        public readonly createdAt: Date
    ) {}

    static create(params: { id: string; name: string; addresses?: PostalAddress[]; createdAt?: Date; }) {
        const name = params.name.trim();
        if (!name) throw new Error('School name is required');

        const addresses = params.addresses ?? [];
        if (!Array.isArray(addresses)) throw new Error('School addresses must be an array');
        for (const address of addresses) {
            if (!(address instanceof PostalAddress)) {
                throw new Error('Invalid school address');
            }
        }

        return new School(params.id, name, [...addresses], params.createdAt ?? new Date());
    }

    get addresses(): PostalAddress[] {
        return [...this._addresses];
    }
}
