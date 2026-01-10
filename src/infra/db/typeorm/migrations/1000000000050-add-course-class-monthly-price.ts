import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddCourseClassMonthlyPrice1000000000050 implements MigrationInterface {
    name = 'AddCourseClassMonthlyPrice1000000000050';

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Adicionar monthly_price_cents ao CourseClass
        if (!(await queryRunner.hasColumn('course_classes', 'monthly_price_cents'))) {
            await queryRunner.addColumn(
                'course_classes',
                new TableColumn({
                    name: 'monthly_price_cents',
                    type: 'int',
                    isNullable: true,
                    default: null
                })
            );
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Remover monthly_price_cents do CourseClass
        if (await queryRunner.hasColumn('course_classes', 'monthly_price_cents')) {
            await queryRunner.dropColumn('course_classes', 'monthly_price_cents');
        }
    }
}

