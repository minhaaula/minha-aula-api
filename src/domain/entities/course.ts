export type CourseCategory = {
    categoryId: string;
    subcategoryIds: string[];
};

export class Course {
    private constructor(
        public readonly id: string,
        public readonly schoolId: string,
        public readonly name: string,
        public readonly description: string | null,
        private readonly _categories: CourseCategory[],
        private _isActive: boolean,
        public readonly createdAt: Date
    ) {}

    static create(params: {
        id: string;
        schoolId: string;
        name: string;
        description?: string | null;
        categories?: Array<{ categoryId: string; subcategoryIds?: string[] }>;
        isActive?: boolean;
        createdAt?: Date;
    }) {
        const name = params.name.trim();
        if (!name) throw new Error('Course name is required');
        const schoolId = params.schoolId.trim();
        if (!schoolId) throw new Error('School id is required');
        const description = params.description?.trim() ?? null;
        const categories = Course.normalizeCategories(params.categories);
        return new Course(
            params.id,
            schoolId,
            name,
            description,
            categories,
            params.isActive ?? true,
            params.createdAt ?? new Date()
        );
    }

    get categories(): CourseCategory[] {
        return this._categories.map((category) => ({
            categoryId: category.categoryId,
            subcategoryIds: [...category.subcategoryIds]
        }));
    }

    get isActive() {
        return this._isActive;
    }

    deactivate() {
        this._isActive = false;
    }

    activate() {
        this._isActive = true;
    }

    private static normalizeCategories(values: unknown): CourseCategory[] {
        if (values === undefined) return [];
        if (!Array.isArray(values)) {
            throw new Error('Course categories must be an array');
        }

        const normalized: CourseCategory[] = [];
        const seenCategories = new Set<string>();

        for (const item of values) {
            if (typeof item !== 'object' || item === null) {
                throw new Error('Course categories must be objects');
            }

            const rawCategoryId = typeof (item as { categoryId?: unknown }).categoryId === 'string'
                ? (item as { categoryId: string }).categoryId.trim()
                : '';
            if (!rawCategoryId) {
                throw new Error('Course category id is required');
            }

            const key = rawCategoryId.toLowerCase();
            if (seenCategories.has(key)) continue;
            seenCategories.add(key);

            const subcategoriesInput = (item as { subcategoryIds?: unknown }).subcategoryIds;
            const subcategoryIds = Course.normalizeSubcategories(subcategoriesInput, rawCategoryId);

            normalized.push({ categoryId: rawCategoryId, subcategoryIds });
        }

        return normalized;
    }

    private static normalizeSubcategories(values: unknown, categoryId: string): string[] {
        if (values === undefined) return [];
        if (!Array.isArray(values)) {
            throw new Error(`Course category "${categoryId}" subcategories must be an array`);
        }

        const normalized: string[] = [];
        const seen = new Set<string>();

        for (const value of values) {
            if (typeof value !== 'string') {
                throw new Error(`Course category "${categoryId}" subcategories must contain strings`);
            }

            const trimmed = value.trim();
            if (!trimmed) {
                throw new Error(`Course category "${categoryId}" subcategories cannot contain empty values`);
            }

            const key = trimmed.toLowerCase();
            if (seen.has(key)) continue;
            seen.add(key);
            normalized.push(trimmed);
        }

        return normalized;
    }
}
