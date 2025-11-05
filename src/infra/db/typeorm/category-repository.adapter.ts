import { AppDataSource } from './datasource';
import { CategoryRepository, CategoryWithSubcategories } from '../../../ports/repositories/category.repo';
import { CategoryOrm } from './entities/category.orm';

export class CategoryRepositoryAdapter implements CategoryRepository {
    private readonly repo = AppDataSource.getRepository(CategoryOrm);

    async findAllWithSubcategories(): Promise<CategoryWithSubcategories[]> {
        const rows = await this.repo.find({
            relations: { subcategories: true },
            order: {
                name: 'ASC'
            }
        });

        return rows.map((row) => ({
            id: row.id,
            name: row.name,
            subcategories: (row.subcategories ?? [])
                .sort((a, b) => a.name.localeCompare(b.name))
                .map((subcategory) => ({
                    id: subcategory.id,
                    name: subcategory.name
                }))
        }));
    }
}


