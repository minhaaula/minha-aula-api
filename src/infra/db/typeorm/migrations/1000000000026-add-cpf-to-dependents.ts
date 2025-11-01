import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCpfToDependents1000000000026 implements MigrationInterface {
    name = 'AddCpfToDependents1000000000026';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query('ALTER TABLE dependents ADD COLUMN cpf CHAR(11) NULL');
        await queryRunner.query('ALTER TABLE dependents ADD UNIQUE INDEX idx_dependents_cpf (cpf)');
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query('ALTER TABLE dependents DROP INDEX idx_dependents_cpf');
        await queryRunner.query('ALTER TABLE dependents DROP COLUMN cpf');
    }
}
