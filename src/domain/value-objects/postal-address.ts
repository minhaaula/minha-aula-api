export type PostalAddressProps = {
    street: string;
    number: string;
    complement?: string | null;
    district?: string | null;
    city: string;
    state: string;
    zipCode: string;
};

export class PostalAddress {
    private constructor(
        public readonly street: string,
        public readonly number: string,
        public readonly complement: string | null,
        public readonly district: string | null,
        public readonly city: string,
        public readonly state: string,
        public readonly zipCode: string
    ) {}

    static create(props: PostalAddressProps) {
        const street = props.street.trim();
        if (!street) throw new Error('Street is required');

        const number = props.number.trim();
        if (!number) throw new Error('Address number is required');

        const city = props.city.trim();
        if (!city) throw new Error('City is required');

        const state = props.state.trim();
        if (!state) throw new Error('State is required');

        const zipCode = PostalAddress.normalizeZipCode(props.zipCode);
        if (!zipCode) throw new Error('Zip code is required');
        if (zipCode.length !== 8) throw new Error('Invalid zip code');

        const complement = props.complement?.trim() || null;
        const district = props.district?.trim() || null;

        return new PostalAddress(street, number, complement, district, city, state, zipCode);
    }

    private static normalizeZipCode(value: string) {
        return value.replace(/\D/g, '');
    }

    toPrimitives(): PostalAddressProps {
        return {
            street: this.street,
            number: this.number,
            complement: this.complement,
            district: this.district,
            city: this.city,
            state: this.state,
            zipCode: this.zipCode
        };
    }
}
