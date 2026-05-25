import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUserStudentAccessEnabled1000000000081 implements MigrationInterface {
    name = 'AddUserStudentAccessEnabled1000000000081';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE users
            ADD COLUMN student_access_enabled TINYINT(1) NOT NULL DEFAULT 1
            AFTER persona
        `);

        await queryRunner.query(`
            UPDATE users u
            INNER JOIN schools s ON s.owner_user_id = u.id
            SET u.student_access_enabled = 1
            WHERE u.persona = 'SCHOOL'
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE users
            DROP COLUMN student_access_enabled
        `);
    }
}
