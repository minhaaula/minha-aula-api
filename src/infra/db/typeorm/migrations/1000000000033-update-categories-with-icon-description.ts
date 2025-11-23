import { MigrationInterface, QueryRunner } from 'typeorm';

type CategorySeed = {
    id: string;
    name: string;
    icon: string;
    description: string;
    subcategories: Array<{ id: string; name: string }>;
};

const CATEGORIES: CategorySeed[] = [
    {
        id: 'idiomas',
        name: 'Idiomas',
        icon: 'language',
        description: 'Cursos de idiomas para todas as idades e níveis.',
        subcategories: [
            { id: 'ingles', name: 'Inglês' },
            { id: 'espanhol', name: 'Espanhol' },
            { id: 'frances', name: 'Francês' },
            { id: 'alemao', name: 'Alemão' },
            { id: 'italiano', name: 'Italiano' },
            { id: 'mandarim', name: 'Mandarim' },
            { id: 'japones', name: 'Japonês' },
            { id: 'portugues', name: 'Português / Redação' }
        ]
    },
    {
        id: 'musica',
        name: 'Música',
        icon: 'musical-notes',
        description: 'Aulas de instrumentos musicais, canto e teoria.',
        subcategories: [
            { id: 'piano', name: 'Piano / Teclado' },
            { id: 'violao', name: 'Violão' },
            { id: 'guitarra', name: 'Guitarra' },
            { id: 'baixo', name: 'Baixo' },
            { id: 'canto', name: 'Canto' },
            { id: 'bateria', name: 'Bateria' },
            { id: 'violino', name: 'Violino' },
            { id: 'saxofone', name: 'Saxofone' },
            { id: 'flauta', name: 'Flauta' },
            { id: 'producao_musical', name: 'Produção Musical / DJ' },
            { id: 'teoria', name: 'Teoria Musical' }
        ]
    },
    {
        id: 'danca',
        name: 'Dança',
        icon: 'body',
        description: 'Cursos de dança artística, esportiva e moderna.',
        subcategories: [
            { id: 'ballet', name: 'Ballet' },
            { id: 'jazz', name: 'Jazz' },
            { id: 'contemporanea', name: 'Dança Contemporânea' },
            { id: 'hiphop', name: 'Hip Hop' },
            { id: 'urbanas', name: 'Danças Urbanas' },
            { id: 'zumba', name: 'Zumba' },
            { id: 'salao', name: 'Dança de Salão' },
            { id: 'kpop', name: 'K-Pop Dance' },
            { id: 'sapateado', name: 'Sapateado' }
        ]
    },
    {
        id: 'esportes',
        name: 'Esportes',
        icon: 'football',
        description: 'Atividades esportivas e aulas em clubes e academias.',
        subcategories: [
            { id: 'futebol', name: 'Futebol' },
            { id: 'futsal', name: 'Futsal' },
            { id: 'volei', name: 'Vôlei' },
            { id: 'basquete', name: 'Basquete' },
            { id: 'handebol', name: 'Handebol' },
            { id: 'natacao', name: 'Natação' },
            { id: 'jiujitsu', name: 'Jiu-jitsu' },
            { id: 'muaythai', name: 'Muay Thai' },
            { id: 'judo', name: 'Judô' },
            { id: 'taekwondo', name: 'Taekwondo' },
            { id: 'karate', name: 'Karatê' },
            { id: 'tenis', name: 'Tênis' },
            { id: 'beachtennis', name: 'Beach Tennis' },
            { id: 'skate', name: 'Skate' },
            { id: 'ginastica_artistica', name: 'Ginástica Artística' },
            { id: 'ginastica_ritmica', name: 'Ginástica Rítmica' },
            { id: 'atletismo', name: 'Atletismo' }
        ]
    },
    {
        id: 'artes',
        name: 'Artes',
        icon: 'color-palette',
        description: 'Atividades artísticas, criativas e culturais.',
        subcategories: [
            { id: 'desenho', name: 'Desenho' },
            { id: 'pintura', name: 'Pintura' },
            { id: 'artesanato', name: 'Artesanato' },
            { id: 'escultura', name: 'Escultura' },
            { id: 'origami', name: 'Origami' },
            { id: 'lettering', name: 'Lettering' },
            { id: 'manga', name: 'Desenho Mangá' },
            { id: 'ceramica', name: 'Cerâmica' },
            { id: 'teatro', name: 'Teatro / Atuação' },
            { id: 'fotografia', name: 'Fotografia' }
        ]
    },
    {
        id: 'tecnologia',
        name: 'Tecnologia',
        icon: 'laptop',
        description: 'Cursos modernos para crianças, jovens e adultos.',
        subcategories: [
            { id: 'robotica', name: 'Robótica' },
            { id: 'programacao_infantil', name: 'Programação Infantil' },
            { id: 'programacao_jovem', name: 'Programação Jovem / Python' },
            { id: 'games', name: 'Criação de Jogos' },
            { id: 'informatica', name: 'Informática Básica' },
            { id: 'logica', name: 'Raciocínio Lógico' },
            { id: 'apps', name: 'Criação de Aplicativos' },
            { id: 'design_digital', name: 'Design Digital' }
        ]
    },
    {
        id: 'bem-estar',
        name: 'Bem-estar',
        icon: 'heart',
        description: 'Atividades para saúde mental e qualidade de vida.',
        subcategories: [
            { id: 'yoga', name: 'Yoga' },
            { id: 'pilates', name: 'Pilates' },
            { id: 'meditacao', name: 'Meditação' },
            { id: 'alongamento', name: 'Alongamento' },
            { id: 'funcional', name: 'Treinamento Funcional' },
            { id: 'capoeira', name: 'Capoeira' }
        ]
    },
    {
        id: 'reforco',
        name: 'Reforço Escolar',
        icon: 'school',
        description: 'Acompanhamento escolar e apoio acadêmico.',
        subcategories: [
            { id: 'matematica', name: 'Matemática' },
            { id: 'portugues_reforco', name: 'Português' },
            { id: 'ciencias', name: 'Ciências' },
            { id: 'historia', name: 'História' },
            { id: 'geografia', name: 'Geografia' },
            { id: 'fisica', name: 'Física' },
            { id: 'quimica', name: 'Química' },
            { id: 'biologia', name: 'Biologia' },
            { id: 'acompanhamento', name: 'Acompanhamento Escolar' },
            { id: 'preparatorio_enem', name: 'Preparatório ENEM' },
            { id: 'reforco_infantil', name: 'Reforço Infantil' }
        ]
    },
    {
        id: 'profissionalizantes',
        name: 'Cursos Profissionalizantes',
        icon: 'briefcase',
        description: 'Cursos rápidos de capacitação.',
        subcategories: [
            { id: 'barbearia', name: 'Barbearia' },
            { id: 'cabeleireiro', name: 'Cabeleireiro' },
            { id: 'manicure', name: 'Manicure' },
            { id: 'maquiagem', name: 'Maquiagem' },
            { id: 'gastronomia', name: 'Gastronomia' },
            { id: 'confeitaria', name: 'Confeitaria' },
            { id: 'costura', name: 'Costura' },
            { id: 'designer_grafico', name: 'Designer Gráfico' },
            { id: 'marketing_digital', name: 'Marketing Digital' }
        ]
    }
];

export class UpdateCategoriesWithIconDescription1000000000033 implements MigrationInterface {
    name = 'UpdateCategoriesWithIconDescription1000000000033';

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Verifica se os campos icon e description existem e os adiciona se necessário
        const hasIconColumn = await queryRunner.query(`
            SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'categories' AND COLUMN_NAME = 'icon';
        `);
        if (hasIconColumn.length === 0) {
            await queryRunner.query(`
                ALTER TABLE categories
                ADD COLUMN icon VARCHAR(191) NULL AFTER name;
            `);
        }

        const hasDescriptionColumn = await queryRunner.query(`
            SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'categories' AND COLUMN_NAME = 'description';
        `);
        if (hasDescriptionColumn.length === 0) {
            await queryRunner.query(`
                ALTER TABLE categories
                ADD COLUMN description TEXT NULL AFTER icon;
            `);
        }

        // Insere ou atualiza as categorias
        for (const category of CATEGORIES) {
            const existingCategory = await queryRunner.query(
                'SELECT id FROM categories WHERE id = ? OR name = ? LIMIT 1',
                [category.id, category.name]
            );

            if (existingCategory.length === 0) {
                // Insere nova categoria
                await queryRunner.query(
                    `INSERT INTO categories (id, name, icon, description, created_at) VALUES (?, ?, ?, ?, NOW())`,
                    [category.id, category.name, category.icon, category.description]
                );
            } else {
                // Atualiza categoria existente
                const categoryId = existingCategory[0].id;
                await queryRunner.query(
                    `UPDATE categories SET name = ?, icon = ?, description = ? WHERE id = ?`,
                    [category.name, category.icon, category.description, categoryId]
                );
                // Usa o ID existente se o ID fornecido for diferente
                if (categoryId !== category.id) {
                    category.id = categoryId;
                }
            }

            // Insere ou atualiza as subcategorias
            for (const subcategory of category.subcategories) {
                const existingSubcategory = await queryRunner.query(
                    'SELECT id FROM subcategories WHERE id = ? OR (category_id = ? AND name = ?) LIMIT 1',
                    [subcategory.id, category.id, subcategory.name]
                );

                if (existingSubcategory.length === 0) {
                    // Insere nova subcategoria
                    await queryRunner.query(
                        `INSERT INTO subcategories (id, category_id, name, created_at) VALUES (?, ?, ?, NOW())`,
                        [subcategory.id, category.id, subcategory.name]
                    );
                } else {
                    // Atualiza subcategoria existente
                    const subcategoryId = existingSubcategory[0].id;
                    await queryRunner.query(
                        `UPDATE subcategories SET name = ? WHERE id = ?`,
                        [subcategory.name, subcategoryId]
                    );
                }
            }
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Remove os dados inseridos
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

        // Remove os campos icon e description se existirem
        const hasIconColumn = await queryRunner.query(`
            SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'categories' AND COLUMN_NAME = 'icon';
        `);
        if (hasIconColumn.length > 0) {
            await queryRunner.query('ALTER TABLE categories DROP COLUMN icon;');
        }

        const hasDescriptionColumn = await queryRunner.query(`
            SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'categories' AND COLUMN_NAME = 'description';
        `);
        if (hasDescriptionColumn.length > 0) {
            await queryRunner.query('ALTER TABLE categories DROP COLUMN description;');
        }
    }
}

