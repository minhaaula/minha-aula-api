import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Permite nova matrícula na mesma turma após cancelamento (linha CANCELLED permanece no histórico).
 * Unicidade só para matrículas ACTIVE/PENDING.
 */
export class EnrollmentPartialUniqueActive1000000000079 implements MigrationInterface {
    name = 'EnrollmentPartialUniqueActive1000000000079';

    private async indexExists(
        queryRunner: QueryRunner,
        tableName: string,
        indexName: string
    ): Promise<boolean> {
        const rows = await queryRunner.query(
            `
            SELECT 1 AS found
            FROM information_schema.statistics
            WHERE table_schema = DATABASE()
              AND table_name = ?
              AND index_name = ?
            LIMIT 1
            `,
            [tableName, indexName]
        );
        return Array.isArray(rows) && rows.length > 0;
    }

    private async ensureIndex(
        queryRunner: QueryRunner,
        tableName: string,
        indexName: string,
        columnsSql: string
    ): Promise<void> {
        if (await this.indexExists(queryRunner, tableName, indexName)) {
            return;
        }
        await queryRunner.query(`CREATE INDEX ${indexName} ON ${tableName} (${columnsSql})`);
    }

    public async up(queryRunner: QueryRunner): Promise<void> {
        // FKs (course_class_id, student_user_id, dependent_id) usam os UNIQUE antigos como índice.
        // Criar índices não únicos antes de dropar os UNIQUE.
        await this.ensureIndex(queryRunner, 'enrollments', 'idx_enrollments_class', 'course_class_id');
        await this.ensureIndex(queryRunner, 'enrollments', 'idx_enrollments_student_user', 'student_user_id');
        await this.ensureIndex(queryRunner, 'enrollments', 'idx_enrollments_dependent', 'dependent_id');

        if (await this.indexExists(queryRunner, 'enrollments', 'uq_enrollments_class_student_user')) {
            await queryRunner.query(`
                ALTER TABLE enrollments DROP INDEX uq_enrollments_class_student_user
            `);
        }
        if (await this.indexExists(queryRunner, 'enrollments', 'uq_enrollments_class_dependent')) {
            await queryRunner.query(`
                ALTER TABLE enrollments DROP INDEX uq_enrollments_class_dependent
            `);
        }

        if (!(await queryRunner.hasColumn('enrollments', 'active_class_student_user_key'))) {
            await queryRunner.query(`
                ALTER TABLE enrollments
                ADD COLUMN active_class_student_user_key VARCHAR(73) AS (
                    IF(
                        status IN ('ACTIVE', 'PENDING') AND student_user_id IS NOT NULL,
                        CONCAT(course_class_id, '|', student_user_id),
                        NULL
                    )
                ) STORED
            `);
        }

        if (!(await queryRunner.hasColumn('enrollments', 'active_class_dependent_key'))) {
            await queryRunner.query(`
                ALTER TABLE enrollments
                ADD COLUMN active_class_dependent_key VARCHAR(73) AS (
                    IF(
                        status IN ('ACTIVE', 'PENDING') AND dependent_id IS NOT NULL,
                        CONCAT(course_class_id, '|', dependent_id),
                        NULL
                    )
                ) STORED
            `);
        }

        if (!(await this.indexExists(queryRunner, 'enrollments', 'uq_enrollments_active_class_student_user'))) {
            await queryRunner.query(`
                CREATE UNIQUE INDEX uq_enrollments_active_class_student_user
                ON enrollments (active_class_student_user_key)
            `);
        }

        if (!(await this.indexExists(queryRunner, 'enrollments', 'uq_enrollments_active_class_dependent'))) {
            await queryRunner.query(`
                CREATE UNIQUE INDEX uq_enrollments_active_class_dependent
                ON enrollments (active_class_dependent_key)
            `);
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        if (await this.indexExists(queryRunner, 'enrollments', 'uq_enrollments_active_class_student_user')) {
            await queryRunner.query(`
                ALTER TABLE enrollments DROP INDEX uq_enrollments_active_class_student_user
            `);
        }
        if (await this.indexExists(queryRunner, 'enrollments', 'uq_enrollments_active_class_dependent')) {
            await queryRunner.query(`
                ALTER TABLE enrollments DROP INDEX uq_enrollments_active_class_dependent
            `);
        }

        if (await queryRunner.hasColumn('enrollments', 'active_class_student_user_key')) {
            await queryRunner.query('ALTER TABLE enrollments DROP COLUMN active_class_student_user_key');
        }
        if (await queryRunner.hasColumn('enrollments', 'active_class_dependent_key')) {
            await queryRunner.query('ALTER TABLE enrollments DROP COLUMN active_class_dependent_key');
        }

        if (!(await this.indexExists(queryRunner, 'enrollments', 'uq_enrollments_class_student_user'))) {
            await queryRunner.query(`
                CREATE UNIQUE INDEX uq_enrollments_class_student_user
                ON enrollments (course_class_id, student_user_id)
            `);
        }
        if (!(await this.indexExists(queryRunner, 'enrollments', 'uq_enrollments_class_dependent'))) {
            await queryRunner.query(`
                CREATE UNIQUE INDEX uq_enrollments_class_dependent
                ON enrollments (course_class_id, dependent_id)
            `);
        }
    }
}
