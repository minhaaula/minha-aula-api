import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDependentPhotoUrl1000000000076 implements MigrationInterface {
    name = 'AddDependentPhotoUrl1000000000076';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE dependents
            ADD COLUMN photo_url VARCHAR(500) NULL AFTER relationship;
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE dependents
            DROP COLUMN photo_url;
        `);
    }
}
