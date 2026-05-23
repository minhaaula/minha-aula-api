import { In, Not } from 'typeorm';
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
        const normalizedSubs = input.subcategories.map((sub) => ({
            id: sub.id.trim(),
            name: sub.name.trim()
        }));
        const inputIds = normalizedSubs.map((sub) => sub.id);

        await this.repo.save({
            id: input.id,
            name: input.name.trim(),
            icon: input.icon?.trim() ?? null,
            description: input.description?.trim() ?? null
        });

        if (inputIds.length > 0) {
            await this.subRepo.delete({
                categoryId: input.id,
                id: Not(In(inputIds))
            });
        } else {
            await this.subRepo.delete({ categoryId: input.id });
        }

        const existingSubs = await this.subRepo.find({
            where: { categoryId: input.id }
        });

        for (const sub of normalizedSubs) {
            const existing = existingSubs.find((row) => row.id.trim() === sub.id);
            if (existing) {
                existing.name = sub.name;
                await this.subRepo.save(existing);
            } else {
                await this.subRepo.save({
                    id: sub.id,
                    categoryId: input.id,
                    name: sub.name
                });
            }
        }
    }
}


