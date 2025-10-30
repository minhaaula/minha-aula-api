import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddEnrollmentRequestFeeFields1000000000025 implements MigrationInterface {
    name = 'AddEnrollmentRequestFeeFields1000000000025';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.addColumns('enrollment_requests', [
            new TableColumn({
                name: 'enrollment_fee_cents',
                type: 'int',
                isNullable: true
            }),
            new TableColumn({
                name: 'enrollment_fee_due_date',
                type: 'date',
                isNullable: true
            }),
            new TableColumn({
                name: 'first_monthly_payment_date',
                type: 'date',
                isNullable: true
            })
        ]);

        await queryRunner.query(`
            UPDATE enrollment_requests
            SET first_monthly_payment_date = DATE(created_at)
            WHERE first_monthly_payment_date IS NULL
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.dropColumn('enrollment_requests', 'first_monthly_payment_date');
        await queryRunner.dropColumn('enrollment_requests', 'enrollment_fee_due_date');
        await queryRunner.dropColumn('enrollment_requests', 'enrollment_fee_cents');
    }
}
