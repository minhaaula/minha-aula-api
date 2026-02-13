import { AppDataSource } from './datasource';
import {
    CategoryRepository,
    CategorySaveInput,
    CategoryWithSubcategories
} from '../../../ports/repositories/category.repo';
import { CategoryOrm } from './entities/category.orm';
import { SubcategoryOrm } from './entities/subcategory.orm';

function mapRow(row: CategoryOrm): CategoryWithSubcategories {
    return {
        id: row.id,
        name: row.name,
        icon: row.icon ?? undefined,
        description: row.description ?? undefined,
        subcategories: (row.subcategories ?? [])
            .sort((a, b) => a.name.localeCompare(b.name))
            .map((sub) => ({ id: sub.id, name: sub.name }))
    };
}

export class CategoryRepositoryAdapter implements CategoryRepository {
    private readonly repo = AppDataSource.getRepository(CategoryOrm);
    private readonly subRepo = AppDataSource.getRepository(SubcategoryOrm);

    async findAllWithSubcategories(): Promise<CategoryWithSubcategories[]> {
        const rows = await this.repo.find({
            relations: { subcategories: true },
            order: { name: 'ASC' }
        });
        return rows.map(mapRow);
    }

    async findById(id: string): Promise<CategoryWithSubcategories | null> {
        const row = await this.repo.findOne({
            where: { id: id.trim() },
            relations: { subcategories: true }
        });
        return row ? mapRow(row) : null;
    }

    async findByName(name: string): Promise<CategoryWithSubcategories | null> {
        const row = await this.repo.findOne({
            where: { name: name.trim() },
            relations: { subcategories: true }
        });
        return row ? mapRow(row) : null;
    }

    async save(input: CategorySaveInput): Promise<void> {
        const categoryRow = await this.repo.findOne({
            where: { id: input.id },
            relations: { subcategories: true }
        });

        if (categoryRow) {
            categoryRow.name = input.name.trim();
            categoryRow.icon = input.icon?.trim() ?? null;
            categoryRow.description = input.description?.trim() ?? null;
            await this.repo.save(categoryRow);
        } else {
            await this.repo.save({
                id: input.id,
                name: input.name.trim(),
                icon: input.icon?.trim() ?? null,
                description: input.description?.trim() ?? null
            });
        }

        const existingSubs = await this.subRepo.find({
            where: { categoryId: input.id }
        });
        const inputIds = new Set(input.subcategories.map((s) => s.id));
        const toRemove = existingSubs.filter((s) => !inputIds.has(s.id));
        if (toRemove.length > 0) {
            await this.subRepo.remove(toRemove);
        }

        for (const sub of input.subcategories) {
            const existing = existingSubs.find((s) => s.id === sub.id);
            if (existing) {
                existing.name = sub.name.trim();
                await this.subRepo.save(existing);
            } else {
                await this.subRepo.save({
                    id: sub.id,
                    categoryId: input.id,
                    name: sub.name.trim()
                });
            }
        }
    }
}


