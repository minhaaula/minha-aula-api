import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddSchoolOnboardingUrl1000000000049 implements MigrationInterface {
    name = 'AddSchoolOnboardingUrl1000000000049'

    public async up(queryRunner: QueryRunner): Promise<void> {
        if (!(await queryRunner.hasColumn('schools', 'onboarding_url'))) {
            await queryRunner.addColumn('schools', new TableColumn({
                name: 'onboarding_url',
                type: 'varchar',
                length: '500',
                isNullable: true,
                default: null
            }));
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        if (await queryRunner.hasColumn('schools', 'onboarding_url')) {
            await queryRunner.dropColumn('schools', 'onboarding_url');
        }
    }
}

