import { MigrationInterface, QueryRunner } from 'typeorm';

const GENDER_ENUM_SQL = "'MALE','FEMALE'";

export class RemoveGenderOther1000000000084 implements MigrationInterface {
    name = 'RemoveGenderOther1000000000084';

    public async up(queryRunner: QueryRunner): Promise<void> {
        if (await queryRunner.hasColumn('users', 'gender')) {
            await queryRunner.query(`UPDATE users SET gender = NULL WHERE gender = 'OTHER'`);
            await queryRunner.query(
                `ALTER TABLE users MODIFY COLUMN gender ENUM(${GENDER_ENUM_SQL}) NULL`
            );
        }

        if (await queryRunner.hasColumn('dependents', 'gender')) {
            await queryRunner.query(`UPDATE dependents SET gender = NULL WHERE gender = 'OTHER'`);
            await queryRunner.query(
                `ALTER TABLE dependents MODIFY COLUMN gender ENUM(${GENDER_ENUM_SQL}) NULL`
            );
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        const withOther = "'MALE','FEMALE','OTHER'";

        if (await queryRunner.hasColumn('users', 'gender')) {
            await queryRunner.query(
                `ALTER TABLE users MODIFY COLUMN gender ENUM(${withOther}) NULL`
            );
        }

        if (await queryRunner.hasColumn('dependents', 'gender')) {
            await queryRunner.query(
                `ALTER TABLE dependents MODIFY COLUMN gender ENUM(${withOther}) NULL`
            );
        }
    }
}
