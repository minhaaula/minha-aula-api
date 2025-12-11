import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddCoursePriceAndEnrollmentFullAmount1000000000039 implements MigrationInterface {
    name = 'AddCoursePriceAndEnrollmentFullAmount1000000000039';

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Adicionar monthlyPriceCents ao Course
        if (!(await queryRunner.hasColumn('courses', 'monthly_price_cents'))) {
            await queryRunner.addColumn('courses', new TableColumn({
                name: 'monthly_price_cents',
                type: 'int',
                isNullable: true,
                default: null
            }));
        }

        // Adicionar fullAmountCents ao Enrollment
        if (!(await queryRunner.hasColumn('enrollments', 'full_amount_cents'))) {
            await queryRunner.addColumn('enrollments', new TableColumn({
                name: 'full_amount_cents',
                type: 'int',
                isNullable: true,
                default: null
            }));
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Remover fullAmountCents do Enrollment
        if (await queryRunner.hasColumn('enrollments', 'full_amount_cents')) {
            await queryRunner.dropColumn('enrollments', 'full_amount_cents');
        }

        // Remover monthlyPriceCents do Course
        if (await queryRunner.hasColumn('courses', 'monthly_price_cents')) {
            await queryRunner.dropColumn('courses', 'monthly_price_cents');
        }
    }
}

