import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddSchoolOnboardingCompletedAt1000000000052 implements MigrationInterface {
    name = 'AddSchoolOnboardingCompletedAt1000000000052'

    public async up(queryRunner: QueryRunner): Promise<void> {
        if (!(await queryRunner.hasColumn('schools', 'onboarding_completed_at'))) {
            await queryRunner.addColumn('schools', new TableColumn({
                name: 'onboarding_completed_at',
                type: 'datetime',
                isNullable: true,
                default: null
            }));
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        if (await queryRunner.hasColumn('schools', 'onboarding_completed_at')) {
            await queryRunner.dropColumn('schools', 'onboarding_completed_at');
        }
    }
}
