import { CategoryRepository } from '../../../ports/repositories/category.repo';
import { Uuid } from '../../../shared/uuid';
import { AppError, ErrorCode } from '../../../shared/errors';

export interface CreateCategoryInput {
    name: string;
    icon?: string | null;
    description?: string | null;
    subcategories?: Array<{ name: string }>;
}

export interface CreateCategoryOutput {
    id: string;
    name: string;
    icon: string | null;
    description: string | null;
    subcategories: Array<{ id: string; name: string }>;
}

export class CreateCategory {
    constructor(private readonly categories: CategoryRepository) {}

    async exec(input: CreateCategoryInput): Promise<CreateCategoryOutput> {
        const name = input.name.trim();
        const existing = await this.categories.findByName(name);
        if (existing) {
            throw new AppError(ErrorCode.ALREADY_EXISTS, 'Já existe uma categoria com este nome', { name });
        }

        const categoryId = Uuid();
        const subcategories = (input.subcategories ?? []).map((s) => ({
            id: Uuid(),
            name: s.name.trim()
        }));

        await this.categories.save({
            id: categoryId,
            name,
            icon: input.icon?.trim() ?? null,
            description: input.description?.trim() ?? null,
            subcategories
        });

        return {
            id: categoryId,
            name,
            icon: input.icon?.trim() ?? null,
            description: input.description?.trim() ?? null,
            subcategories
        };
    }
}
