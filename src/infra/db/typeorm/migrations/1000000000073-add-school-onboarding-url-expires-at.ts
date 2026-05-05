import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddSchoolOnboardingUrlExpiresAt1000000000073 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        const table = await queryRunner.getTable('schools');
        const exists = table?.findColumnByName('onboarding_url_expires_at');
        if (exists) return;

        await queryRunner.addColumn(
            'schools',
            new TableColumn({
                name: 'onboarding_url_expires_at',
                type: 'datetime',
                isNullable: true
            })
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        const table = await queryRunner.getTable('schools');
        const exists = table?.findColumnByName('onboarding_url_expires_at');
        if (!exists) return;
        await queryRunner.dropColumn('schools', 'onboarding_url_expires_at');
    }
}

