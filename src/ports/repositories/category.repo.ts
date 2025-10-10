export type SubcategorySummary = {
    id: string;
    name: string;
};

export type CategoryWithSubcategories = {
    id: string;
    name: string;
    subcategories: SubcategorySummary[];
};

export interface CategoryRepository {
    findAllWithSubcategories(): Promise<CategoryWithSubcategories[]>;
}

