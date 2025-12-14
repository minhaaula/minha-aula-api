import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddEnrollmentPaymentDueDay1000000000041 implements MigrationInterface {
    name = 'AddEnrollmentPaymentDueDay1000000000041';

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Adicionar payment_due_day ao Enrollment
        if (!(await queryRunner.hasColumn('enrollments', 'payment_due_day'))) {
            await queryRunner.addColumn(
                'enrollments',
                new TableColumn({
                    name: 'payment_due_day',
                    type: 'tinyint',
                    width: 2,
                    isNullable: true,
                    comment: 'Dia do mês em que a mensalidade vence (1-31). Se null, usa dia 10 como padrão.'
                })
            );

            // Definir valor padrão para registros existentes (dia 10)
            await queryRunner.query(`
                UPDATE enrollments
                SET payment_due_day = 10
                WHERE payment_due_day IS NULL
            `);
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        if (await queryRunner.hasColumn('enrollments', 'payment_due_day')) {
            await queryRunner.dropColumn('enrollments', 'payment_due_day');
        }
    }
}

