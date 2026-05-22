import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

const EXEMPTION_ENUM = ['EMPLOYEE', 'RELATIVE', 'SCHOLARSHIP', 'NONPROFIT'] as const;

export class AddEnrollmentTuitionExemption1000000000082 implements MigrationInterface {
    name = 'AddEnrollmentTuitionExemption1000000000082';

    public async up(queryRunner: QueryRunner): Promise<void> {
        if (!(await queryRunner.hasColumn('enrollments', 'tuition_exemption_type'))) {
            await queryRunner.addColumn(
                'enrollments',
                new TableColumn({
                    name: 'tuition_exemption_type',
                    type: 'enum',
                    enum: [...EXEMPTION_ENUM],
                    isNullable: true,
                    comment:
                        'Motivo da isenção de mensalidade. Quando preenchido, o aluno não recebe cobranças de mensalidade.'
                })
            );
        }

        if (!(await queryRunner.hasColumn('enrollment_requests', 'tuition_exemption_type'))) {
            await queryRunner.addColumn(
                'enrollment_requests',
                new TableColumn({
                    name: 'tuition_exemption_type',
                    type: 'enum',
                    enum: [...EXEMPTION_ENUM],
                    isNullable: true,
                    comment: 'Motivo da isenção de mensalidade no pedido de matrícula.'
                })
            );
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        if (await queryRunner.hasColumn('enrollment_requests', 'tuition_exemption_type')) {
            await queryRunner.dropColumn('enrollment_requests', 'tuition_exemption_type');
        }
        if (await queryRunner.hasColumn('enrollments', 'tuition_exemption_type')) {
            await queryRunner.dropColumn('enrollments', 'tuition_exemption_type');
        }
    }
}
