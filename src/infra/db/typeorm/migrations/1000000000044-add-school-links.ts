import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddSchoolLinks1000000000044 implements MigrationInterface {
    name = 'AddSchoolLinks1000000000044';

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Adicionar colunas de links à tabela schools
        const columns = [
            new TableColumn({
                name: 'facebook_link',
                type: 'varchar',
                length: '500',
                isNullable: true,
                default: null
            }),
            new TableColumn({
                name: 'instagram_link',
                type: 'varchar',
                length: '500',
                isNullable: true,
                default: null
            }),
            new TableColumn({
                name: 'tiktok_link',
                type: 'varchar',
                length: '500',
                isNullable: true,
                default: null
            }),
            new TableColumn({
                name: 'youtube_link',
                type: 'varchar',
                length: '500',
                isNullable: true,
                default: null
            }),
            new TableColumn({
                name: 'site_link',
                type: 'varchar',
                length: '500',
                isNullable: true,
                default: null
            })
        ];

        for (const column of columns) {
            if (!(await queryRunner.hasColumn('schools', column.name))) {
                await queryRunner.addColumn('schools', column);
            }
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Remover colunas de links da tabela schools
        const columnNames = [
            'facebook_link',
            'instagram_link',
            'tiktok_link',
            'youtube_link',
            'site_link'
        ];

        for (const columnName of columnNames) {
            if (await queryRunner.hasColumn('schools', columnName)) {
                await queryRunner.dropColumn('schools', columnName);
            }
        }
    }
}

