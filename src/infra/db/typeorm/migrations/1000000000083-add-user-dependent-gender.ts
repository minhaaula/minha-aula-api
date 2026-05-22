import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

const GENDER_ENUM = ['MALE', 'FEMALE'] as const;

export class AddUserDependentGender1000000000083 implements MigrationInterface {
    name = 'AddUserDependentGender1000000000083';

    public async up(queryRunner: QueryRunner): Promise<void> {
        if (!(await queryRunner.hasColumn('users', 'gender'))) {
            await queryRunner.addColumn(
                'users',
                new TableColumn({
                    name: 'gender',
                    type: 'enum',
                    enum: [...GENDER_ENUM],
                    isNullable: true,
                    comment: 'Sexo do usuário (opcional).'
                })
            );
        }

        if (!(await queryRunner.hasColumn('dependents', 'gender'))) {
            await queryRunner.addColumn(
                'dependents',
                new TableColumn({
                    name: 'gender',
                    type: 'enum',
                    enum: [...GENDER_ENUM],
                    isNullable: true,
                    comment: 'Sexo do dependente (opcional).'
                })
            );
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        if (await queryRunner.hasColumn('dependents', 'gender')) {
            await queryRunner.dropColumn('dependents', 'gender');
        }
        if (await queryRunner.hasColumn('users', 'gender')) {
            await queryRunner.dropColumn('users', 'gender');
        }
    }
}
