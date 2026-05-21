import { CategoryRepository } from '../../../ports/repositories/category.repo';

type CategoryItem = {
    id: string;
    name: string;
    subcategories: Array<{
        id: string;
        name: string;
    }>;
};

export class ListCategories {
    constructor(private readonly categories: CategoryRepository) {}

    async exec(): Promise<{ categories: CategoryItem[] }> {
        const items = await this.categories.findAllWithSubcategories();
        return {
            categories: items.map((item) => ({
                id: item.id,
                name: item.name,
                subcategories: item.subcategories.map((sub) => ({
                    id: sub.id,
                    name: sub.name
                }))
            }))
        };
    }
}

