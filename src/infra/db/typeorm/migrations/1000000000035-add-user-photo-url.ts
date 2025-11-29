import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUserPhotoUrl1000000000035 implements MigrationInterface {
    name = 'AddUserPhotoUrl1000000000035';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE users 
            ADD COLUMN photo_url VARCHAR(500) NULL AFTER password_hash;
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE users 
            DROP COLUMN photo_url;
        `);
    }
}

