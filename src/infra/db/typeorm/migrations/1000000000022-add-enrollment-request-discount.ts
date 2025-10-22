import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddEnrollmentRequestDiscount1000000000022 implements MigrationInterface {
    name = 'AddEnrollmentRequestDiscount1000000000022';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.addColumn('enrollment_requests', new TableColumn({
            name: 'discount_cents',
            type: 'int',
            isNullable: true
        }));
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.dropColumn('enrollment_requests', 'discount_cents');
    }
}
