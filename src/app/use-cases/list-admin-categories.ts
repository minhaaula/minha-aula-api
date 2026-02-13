import type { CategoryRepository, CategoryWithSubcategories } from '../../ports/repositories/category.repo';

export type AdminCategoryItem = CategoryWithSubcategories;

export class ListAdminCategories {
    constructor(private readonly categories: CategoryRepository) {}

    async exec(): Promise<{ categories: AdminCategoryItem[] }> {
        const items = await this.categories.findAllWithSubcategories();
        return { categories: items };
    }
}
