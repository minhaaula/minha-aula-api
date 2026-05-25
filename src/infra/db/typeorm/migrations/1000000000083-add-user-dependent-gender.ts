import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

const GENDER_ENUM = ['MALE', 'FEMALE'] as const;
const MYSQL_DUP_FIELDNAME = 1060;

function isMysqlDuplicateColumnName(e: unknown): boolean {
    if (e === null || typeof e !== 'object') return false;
    const o = e as { errno?: number; driverError?: { errno?: number }; code?: string };
    const errno = o.driverError?.errno ?? o.errno;
    return errno === MYSQL_DUP_FIELDNAME || o.code === 'ER_DUP_FIELDNAME';
}

async function hasGenderColumn(queryRunner: QueryRunner, table: string): Promise<boolean> {
    const rows: unknown[] = await queryRunner.query(
        `SELECT 1 AS ok FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = 'gender'
         LIMIT 1`,
        [table]
    );
    return Array.isArray(rows) && rows.length > 0;
}

async function addGenderColumn(
    queryRunner: QueryRunner,
    table: 'users' | 'dependents',
    comment: string
): Promise<void> {
    if (await hasGenderColumn(queryRunner, table)) {
        return;
    }

    try {
        await queryRunner.addColumn(
            table,
            new TableColumn({
                name: 'gender',
                type: 'enum',
                enum: [...GENDER_ENUM],
                isNullable: true,
                comment
            })
        );
    } catch (e) {
        if (!isMysqlDuplicateColumnName(e)) {
            throw e;
        }
    }
}

export class AddUserDependentGender1000000000083 implements MigrationInterface {
    name = 'AddUserDependentGender1000000000083';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await addGenderColumn(queryRunner, 'users', 'Sexo do usuário (opcional).');
        await addGenderColumn(queryRunner, 'dependents', 'Sexo do dependente (opcional).');
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        if (await hasGenderColumn(queryRunner, 'dependents')) {
            await queryRunner.dropColumn('dependents', 'gender');
        }
        if (await hasGenderColumn(queryRunner, 'users')) {
            await queryRunner.dropColumn('users', 'gender');
        }
    }
}
