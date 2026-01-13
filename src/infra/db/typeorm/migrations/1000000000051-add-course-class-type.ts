import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddCourseClassType1000000000051 implements MigrationInterface {
    name = 'AddCourseClassType1000000000051';

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Adicionar class_type ao CourseClass
        if (!(await queryRunner.hasColumn('course_classes', 'class_type'))) {
            await queryRunner.addColumn(
                'course_classes',
                new TableColumn({
                    name: 'class_type',
                    type: 'enum',
                    enum: ['PRESENCIAL', 'ONLINE'],
                    default: "'PRESENCIAL'",
                    isNullable: false
                })
            );
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Remover class_type do CourseClass
        if (await queryRunner.hasColumn('course_classes', 'class_type')) {
            await queryRunner.dropColumn('course_classes', 'class_type');
        }
    }
}
