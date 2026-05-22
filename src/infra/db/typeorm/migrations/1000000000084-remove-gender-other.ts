import { MigrationInterface, QueryRunner } from 'typeorm';

const GENDER_ENUM_SQL = "'MALE','FEMALE'";

async function hasGenderColumn(queryRunner: QueryRunner, table: string): Promise<boolean> {
    const rows: unknown[] = await queryRunner.query(
        `SELECT 1 AS ok FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = 'gender'
         LIMIT 1`,
        [table]
    );
    return Array.isArray(rows) && rows.length > 0;
}

export class RemoveGenderOther1000000000084 implements MigrationInterface {
    name = 'RemoveGenderOther1000000000084';

    public async up(queryRunner: QueryRunner): Promise<void> {
        if (await hasGenderColumn(queryRunner, 'users')) {
            await queryRunner.query(`UPDATE users SET gender = NULL WHERE gender = 'OTHER'`);
            await queryRunner.query(
                `ALTER TABLE users MODIFY COLUMN gender ENUM(${GENDER_ENUM_SQL}) NULL`
            );
        }

        if (await hasGenderColumn(queryRunner, 'dependents')) {
            await queryRunner.query(`UPDATE dependents SET gender = NULL WHERE gender = 'OTHER'`);
            await queryRunner.query(
                `ALTER TABLE dependents MODIFY COLUMN gender ENUM(${GENDER_ENUM_SQL}) NULL`
            );
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        const withOther = "'MALE','FEMALE','OTHER'";

        if (await hasGenderColumn(queryRunner, 'users')) {
            await queryRunner.query(
                `ALTER TABLE users MODIFY COLUMN gender ENUM(${withOther}) NULL`
            );
        }

        if (await hasGenderColumn(queryRunner, 'dependents')) {
            await queryRunner.query(
                `ALTER TABLE dependents MODIFY COLUMN gender ENUM(${withOther}) NULL`
            );
        }
    }
}
