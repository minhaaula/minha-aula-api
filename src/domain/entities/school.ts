import { PostalAddress } from '../value-objects/postal-address';
import { Email } from '../value-objects/email';

export type SchoolCategory = {
    categoryId: string;
    subcategoryIds: string[];
};

export class School {
    private constructor(
        public readonly id: string,
        public readonly name: string,
        private readonly _addresses: PostalAddress[],
        public readonly createdAt: Date,
        private readonly _email: Email,
        private readonly _phone: string,
        private readonly _cnpj: string,
        private readonly _ownerUserId: string | null,
        private readonly _categories: SchoolCategory[]
    ) {}

    static create(params: {
        id: string;
        name: string;
        email: string;
        phone: string;
        cnpj: string;
        addresses?: PostalAddress[];
        ownerUserId?: string | null;
        categories?: Array<{ categoryId: string; subcategoryIds?: string[] }>;
        createdAt?: Date;
    }) {
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

        const ownerUserId = params.ownerUserId ? params.ownerUserId.trim() : null;
        const categories = School.normalizeCategories(params.categories);

        return new School(
            params.id,
            name,
            [...addresses],
            params.createdAt ?? new Date(),
            email,
            phone,
            cnpj,
            ownerUserId && ownerUserId.length ? ownerUserId : null,
            categories
        );
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

    get ownerUserId(): string | null {
        return this._ownerUserId;
    }

    get categories(): SchoolCategory[] {
        return this._categories.map((category) => ({
            categoryId: category.categoryId,
            subcategoryIds: [...category.subcategoryIds]
        }));
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

    private static normalizeCategories(values: unknown): SchoolCategory[] {
        if (values === undefined) return [];
        if (!Array.isArray(values)) {
            throw new Error('School categories must be an array');
        }

        const normalized: SchoolCategory[] = [];
        const seenCategories = new Set<string>();

        for (const item of values) {
            if (typeof item !== 'object' || item === null) {
                throw new Error('School categories must be objects');
            }

            const rawCategoryId = typeof (item as { categoryId?: unknown }).categoryId === 'string'
                ? (item as { categoryId: string }).categoryId.trim()
                : '';
            if (!rawCategoryId) {
                throw new Error('School category id is required');
            }

            const key = rawCategoryId.toLowerCase();
            if (seenCategories.has(key)) continue;
            seenCategories.add(key);

            const subcategoriesInput = (item as { subcategoryIds?: unknown }).subcategoryIds;
            const subcategoryIds = School.normalizeSubcategories(subcategoriesInput, rawCategoryId);

            normalized.push({ categoryId: rawCategoryId, subcategoryIds });
        }

        return normalized;
    }

    private static normalizeSubcategories(values: unknown, categoryId: string): string[] {
        if (values === undefined) return [];
        if (!Array.isArray(values)) {
            throw new Error(`School category "${categoryId}" subcategories must be an array`);
        }

        const normalized: string[] = [];
        const seen = new Set<string>();

        for (const value of values) {
            if (typeof value !== 'string') {
                throw new Error(`School category "${categoryId}" subcategories must contain strings`);
            }

            const trimmed = value.trim();
            if (!trimmed) {
                throw new Error(`School category "${categoryId}" subcategories cannot contain empty values`);
            }

            const key = trimmed.toLowerCase();
            if (seen.has(key)) continue;
            seen.add(key);
            normalized.push(trimmed);
        }

        return normalized;
    }
}
