import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddEnrollmentDiscountFields1000000000085 implements MigrationInterface {
    name = 'AddEnrollmentDiscountFields1000000000085';

    public async up(queryRunner: QueryRunner): Promise<void> {
        if (!(await queryRunner.hasColumn('enrollments', 'discount_cents'))) {
            await queryRunner.addColumn(
                'enrollments',
                new TableColumn({
                    name: 'discount_cents',
                    type: 'int',
                    isNullable: true,
                    comment: 'Desconto mensal em centavos (opcional).'
                })
            );
        }

        if (!(await queryRunner.hasColumn('enrollments', 'discount_months'))) {
            await queryRunner.addColumn(
                'enrollments',
                new TableColumn({
                    name: 'discount_months',
                    type: 'int',
                    isNullable: true,
                    comment: 'Quantidade de meses com desconto (opcional).'
                })
            );
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        if (await queryRunner.hasColumn('enrollments', 'discount_months')) {
            await queryRunner.dropColumn('enrollments', 'discount_months');
        }
        if (await queryRunner.hasColumn('enrollments', 'discount_cents')) {
            await queryRunner.dropColumn('enrollments', 'discount_cents');
        }
    }
}
