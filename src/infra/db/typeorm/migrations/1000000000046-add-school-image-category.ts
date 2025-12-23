import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddSchoolImageCategory1000000000046 implements MigrationInterface {
    name = 'AddSchoolImageCategory1000000000046';

    public async up(queryRunner: QueryRunner): Promise<void> {
        const table = await queryRunner.getTable('school_images');
        if (table) {
            const hasCategory = table.columns.find(col => col.name === 'category');
            if (!hasCategory) {
                await queryRunner.addColumn(
                    'school_images',
                    new TableColumn({
                        name: 'category',
                        type: 'varchar',
                        length: '50',
                        default: "'GALLERY'"
                    })
                );
            }
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        const table = await queryRunner.getTable('school_images');
        if (table) {
            const hasCategory = await queryRunner.hasColumn('school_images', 'category');
            if (hasCategory) {
                await queryRunner.dropColumn('school_images', 'category');
            }
        }
    }
}

