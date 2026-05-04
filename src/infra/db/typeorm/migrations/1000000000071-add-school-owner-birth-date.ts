import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddSchoolOwnerBirthDate1000000000071 implements MigrationInterface {
    name = 'AddSchoolOwnerBirthDate1000000000071';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.addColumn(
            'schools',
            new TableColumn({
                name: 'owner_birth_date',
                type: 'date',
                isNullable: true
            })
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.dropColumn('schools', 'owner_birth_date');
    }
}
