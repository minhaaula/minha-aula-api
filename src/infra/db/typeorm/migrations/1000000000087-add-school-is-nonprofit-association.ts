import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSchoolIsNonprofitAssociation1000000000087 implements MigrationInterface {
    name = 'AddSchoolIsNonprofitAssociation1000000000087';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE schools
                ADD is_nonprofit_association TINYINT(1) NOT NULL DEFAULT 0
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE schools
                DROP COLUMN is_nonprofit_association
        `);
    }
}
