export type SubcategorySummary = {
    id: string;
    name: string;
};

export type CategoryWithSubcategories = {
    id: string;
    name: string;
    icon?: string | null;
    description?: string | null;
    subcategories: SubcategorySummary[];
};

export type CategorySaveInput = {
    id: string;
    name: string;
    icon?: string | null;
    description?: string | null;
    subcategories: Array<{ id: string; name: string }>;
};

export interface CategoryRepository {
    findAllWithSubcategories(): Promise<CategoryWithSubcategories[]>;
    findById(id: string): Promise<CategoryWithSubcategories | null>;
    findByName(name: string): Promise<CategoryWithSubcategories | null>;
    save(input: CategorySaveInput): Promise<void>;
}

