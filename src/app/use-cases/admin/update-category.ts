import { CategoryRepository } from '../../../ports/repositories/category.repo';
import { Uuid } from '../../../shared/uuid';
import { AppError, ErrorCode } from '../../../shared/errors';

export interface UpdateCategoryInput {
    categoryId: string;
    name?: string;
    icon?: string | null;
    description?: string | null;
    subcategories?: Array<{ id?: string; name: string }>;
}

export interface UpdateCategoryOutput {
    id: string;
    name: string;
    icon: string | null;
    description: string | null;
    subcategories: Array<{ id: string; name: string }>;
}

export class UpdateCategory {
    constructor(private readonly categories: CategoryRepository) {}

    async exec(input: UpdateCategoryInput): Promise<UpdateCategoryOutput> {
        const existing = await this.categories.findById(input.categoryId);
        if (!existing) {
            throw AppError.notFound('Categoria', { categoryId: input.categoryId });
        }

        const name = input.name !== undefined ? input.name.trim() : existing.name;
        if (name !== existing.name) {
            const byName = await this.categories.findByName(name);
            if (byName) {
                throw new AppError(ErrorCode.ALREADY_EXISTS, 'Já existe uma categoria com este nome', { name });
            }
        }

        const subcategories =
            input.subcategories !== undefined
                ? input.subcategories.map((s) => ({
                      id: s.id?.trim() ? s.id : Uuid(),
                      name: s.name.trim()
                  }))
                : existing.subcategories;

        await this.categories.save({
            id: existing.id,
            name,
            icon: input.icon !== undefined ? (input.icon?.trim() ?? null) : (existing.icon ?? null),
            description:
                input.description !== undefined ? (input.description?.trim() ?? null) : (existing.description ?? null),
            subcategories
        });

        return {
            id: existing.id,
            name,
            icon: input.icon !== undefined ? (input.icon?.trim() ?? null) : (existing.icon ?? null),
            description:
                input.description !== undefined ? (input.description?.trim() ?? null) : (existing.description ?? null),
            subcategories
        };
    }
}
