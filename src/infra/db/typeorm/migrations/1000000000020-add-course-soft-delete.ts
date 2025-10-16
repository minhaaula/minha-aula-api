import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddCourseSoftDelete1000000000020 implements MigrationInterface {
    name = 'AddCourseSoftDelete1000000000020';

    public async up(queryRunner: QueryRunner): Promise<void> {
        const hasColumn = await queryRunner.hasColumn('courses', 'deleted_at');
        if (!hasColumn) {
            await queryRunner.addColumn('courses', new TableColumn({
                name: 'deleted_at',
                type: 'datetime',
                isNullable: true
            }));
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        const hasColumn = await queryRunner.hasColumn('courses', 'deleted_at');
        if (hasColumn) {
            await queryRunner.dropColumn('courses', 'deleted_at');
        }
    }
}
