import { MigrationInterface, QueryRunner } from 'typeorm';

export class SchoolCnpjNullable1000000000070 implements MigrationInterface {
    name = 'SchoolCnpjNullable1000000000070';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query('ALTER TABLE schools MODIFY cnpj CHAR(14) NULL');
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`UPDATE schools SET cnpj = '00000000000000' WHERE cnpj IS NULL`);
        await queryRunner.query('ALTER TABLE schools MODIFY cnpj CHAR(14) NOT NULL');
    }
}
