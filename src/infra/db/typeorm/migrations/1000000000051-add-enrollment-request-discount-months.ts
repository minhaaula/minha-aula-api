import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddEnrollmentRequestDiscountMonths1000000000051 implements MigrationInterface {
    name = 'AddEnrollmentRequestDiscountMonths1000000000051';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.addColumn('enrollment_requests', new TableColumn({
            name: 'discount_months',
            type: 'int',
            isNullable: true
        }));
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.dropColumn('enrollment_requests', 'discount_months');
    }
}

