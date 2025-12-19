import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddDependentSoftDelete1000000000043 implements MigrationInterface {
    name = 'AddDependentSoftDelete1000000000043';

    public async up(queryRunner: QueryRunner): Promise<void> {
        const hasColumn = await queryRunner.hasColumn('dependents', 'deleted_at');
        if (!hasColumn) {
            await queryRunner.addColumn('dependents', new TableColumn({
                name: 'deleted_at',
                type: 'datetime',
                isNullable: true
            }));
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        const hasColumn = await queryRunner.hasColumn('dependents', 'deleted_at');
        if (hasColumn) {
            await queryRunner.dropColumn('dependents', 'deleted_at');
        }
    }
}

