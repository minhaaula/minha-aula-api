import { describe, expect, it } from 'vitest';
import { UpdateCategory } from '../../src/app/use-cases/admin/update-category';
import type { CategoryRepository, CategorySaveInput, CategoryWithSubcategories } from '../../src/ports/repositories/category.repo';
import { AppError } from '../../src/shared/errors';

class InMemoryCategoryRepository implements CategoryRepository {
    private readonly items = new Map<
        string,
        {
            name: string;
            icon: string | null;
            description: string | null;
            subcategories: Array<{ id: string; name: string }>;
        }
    >();

    async findAllWithSubcategories(): Promise<CategoryWithSubcategories[]> {
        return Array.from(this.items.entries()).map(([id, category]) => ({
            id,
            name: category.name,
            icon: category.icon,
            description: category.description,
            subcategories: category.subcategories.map((sub) => ({ ...sub }))
        }));
    }

    async findById(id: string): Promise<CategoryWithSubcategories | null> {
        const category = this.items.get(id);
        if (!category) return null;
        return {
            id,
            name: category.name,
            icon: category.icon,
            description: category.description,
            subcategories: category.subcategories.map((sub) => ({ ...sub }))
        };
    }

    async findByName(name: string): Promise<CategoryWithSubcategories | null> {
        const entry = Array.from(this.items.entries()).find(([, c]) => c.name === name);
        if (!entry) return null;
        const [id, category] = entry;
        return {
            id,
            name: category.name,
            icon: category.icon,
            description: category.description,
            subcategories: category.subcategories.map((sub) => ({ ...sub }))
        };
    }

    async save(input: CategorySaveInput): Promise<void> {
        const existing = this.items.get(input.id);
        this.items.set(input.id, {
            name: input.name,
            icon: input.icon ?? null,
            description: input.description ?? null,
            subcategories: input.subcategories.map((sub) => ({ ...sub }))
        });
        if (!existing) return;
    }

    seed(category: {
        id: string;
        name: string;
        icon?: string | null;
        description?: string | null;
        subcategories?: Array<{ id: string; name: string }>;
    }) {
        this.items.set(category.id, {
            name: category.name,
            icon: category.icon ?? null,
            description: category.description ?? null,
            subcategories: category.subcategories ? category.subcategories.map((sub) => ({ ...sub })) : []
        });
    }
}

describe('UpdateCategory', () => {
    it('remove subcategoria omitida da lista enviada', async () => {
        const categories = new InMemoryCategoryRepository();
        categories.seed({
            id: 'idiomas',
            name: 'Idiomas',
            subcategories: [
                { id: 'ingles', name: 'Inglês' },
                { id: 'espanhol', name: 'Espanhol' }
            ]
        });

        const useCase = new UpdateCategory(categories);
        const result = await useCase.exec({
            categoryId: 'idiomas',
            subcategories: [{ id: 'ingles', name: 'Inglês' }]
        });

        expect(result.subcategories).toEqual([{ id: 'ingles', name: 'Inglês' }]);
        const stored = await categories.findById('idiomas');
        expect(stored?.subcategories).toEqual([{ id: 'ingles', name: 'Inglês' }]);
    });

    it('preserva id existente quando subcategoria é enviada só com nome', async () => {
        const categories = new InMemoryCategoryRepository();
        categories.seed({
            id: 'musica',
            name: 'Música',
            subcategories: [
                { id: 'piano', name: 'Piano' },
                { id: 'violao', name: 'Violão' }
            ]
        });

        const useCase = new UpdateCategory(categories);
        const result = await useCase.exec({
            categoryId: 'musica',
            subcategories: [{ name: 'Piano' }]
        });

        expect(result.subcategories).toEqual([{ id: 'piano', name: 'Piano' }]);
    });

    it('retorna 404 quando categoria não existe', async () => {
        const useCase = new UpdateCategory(new InMemoryCategoryRepository());
        await expect(
            useCase.exec({
                categoryId: 'inexistente',
                subcategories: []
            })
        ).rejects.toBeInstanceOf(AppError);
    });
});
