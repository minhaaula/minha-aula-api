import { MigrationInterface, QueryRunner } from 'typeorm';

type CategorySeed = {
    id: string;
    name: string;
    subcategories: Array<{ id: string; name: string }>;
};

const CATEGORIES: CategorySeed[] = [
    {
        id: '057a76ee-c7bc-415d-9cbf-51a55a6a1632',
        name: 'Esportes',
        subcategories: [
            { id: 'e3f533b8-56d7-4bad-803e-a7cdae51d04c', name: 'Futebol' },
            { id: '29844586-b69a-43e7-95df-05045a3cda4f', name: 'Basquete' },
            { id: '705acac1-e758-4e72-8c9a-025b41c615d5', name: 'Vôlei' },
            { id: '20e97eda-118f-427b-8be7-c74d0c56034f', name: 'Ginástica' }
        ]
    },
    {
        id: 'e51187a9-fc5d-4806-b950-cf067213c608',
        name: 'Artes',
        subcategories: [
            { id: 'ccf7c982-44d2-408d-a68e-a64de6c2f3ca', name: 'Pintura' },
            { id: 'fdc67678-8646-442f-8f8a-aa6256ab6d1d', name: 'Música' },
            { id: '8495e34d-3be7-4a03-8105-c467222171bb', name: 'Dança' },
            { id: 'd628e87c-a36c-4e9c-81b2-9380e7591a4d', name: 'Teatro' }
        ]
    },
    {
        id: '7f7f0e26-5194-4e41-a899-6167f19d116e',
        name: 'Tecnologia',
        subcategories: [
            { id: '39818762-4fab-44a2-a7c1-3079af52e43f', name: 'Robótica' },
            { id: '600f0821-33b9-4dc0-910a-d80685d37f81', name: 'Programação' },
            { id: '4773ba04-3ff2-48c9-af6b-4d0e24e7d6c9', name: 'Design 3D' }
        ]
    },
    {
        id: 'e657b718-08c9-4aaa-8d65-233298902e48',
        name: 'Idiomas',
        subcategories: [
            { id: '713f9320-5710-42a5-8316-6ee56b0b24d1', name: 'Inglês' },
            { id: 'f7de0ecb-526d-4bac-a8da-81cac1b663c6', name: 'Espanhol' },
            { id: '5c1a01f7-d42c-4e57-8393-d9c223c5f5c7', name: 'Francês' }
        ]
    }
];

export class SeedCategories1000000000016 implements MigrationInterface {
    name = 'SeedCategories1000000000016';

    public async up(queryRunner: QueryRunner): Promise<void> {
        for (const category of CATEGORIES) {
            const existingCategory = await queryRunner.query(
                'SELECT id FROM categories WHERE id = ? OR name = ? LIMIT 1',
                [category.id, category.name]
            );

            if (existingCategory.length === 0) {
                await queryRunner.query(
                    `INSERT INTO categories (id, name, created_at) VALUES (?, ?, NOW())`,
                    [category.id, category.name]
                );
            } else {
                // ensure id matches stored row when matched by name
                category.id = existingCategory[0].id;
            }

            for (const subcategory of category.subcategories) {
                const existingSubcategory = await queryRunner.query(
                    'SELECT id FROM subcategories WHERE id = ? OR (category_id = ? AND name = ?) LIMIT 1',
                    [subcategory.id, category.id, subcategory.name]
                );

                if (existingSubcategory.length === 0) {
                    await queryRunner.query(
                        `INSERT INTO subcategories (id, category_id, name, created_at) VALUES (?, ?, ?, NOW())`,
                        [subcategory.id, category.id, subcategory.name]
                    );
                }
            }
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        const ids = CATEGORIES.map((category) => category.id);
        if (ids.length === 0) return;

        const placeholders = ids.map(() => '?').join(',');

        await queryRunner.query(
            `DELETE FROM subcategories WHERE category_id IN (${placeholders})`,
            ids
        );
        await queryRunner.query(
            `DELETE FROM categories WHERE id IN (${placeholders})`,
            ids
        );
    }
}

