import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Permite nova matrícula na mesma turma após cancelamento (linha CANCELLED permanece no histórico).
 * Unicidade só para matrículas ACTIVE/PENDING (colunas de slot mantidas pela aplicação).
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

    private async isGeneratedColumn(
        queryRunner: QueryRunner,
        columnName: string
    ): Promise<boolean> {
        const rows = await queryRunner.query(
            `
            SELECT GENERATION_EXPRESSION AS expr
            FROM information_schema.columns
            WHERE table_schema = DATABASE()
              AND table_name = 'enrollments'
              AND column_name = ?
            LIMIT 1
            `,
            [columnName]
        );
        const expr = Array.isArray(rows) ? rows[0]?.expr : null;
        return expr != null && String(expr).length > 0;
    }

    private async ensurePlainSlotColumn(
        queryRunner: QueryRunner,
        columnName: string
    ): Promise<void> {
        if (await queryRunner.hasColumn('enrollments', columnName)) {
            if (await this.isGeneratedColumn(queryRunner, columnName)) {
                await queryRunner.query(`ALTER TABLE enrollments DROP COLUMN ${columnName}`);
            } else {
                return;
            }
        }
        await queryRunner.query(`
            ALTER TABLE enrollments
            ADD COLUMN ${columnName} VARCHAR(73) NULL
        `);
    }

    /** Cancela duplicatas ACTIVE/PENDING na mesma turma+alvo (mantém a matrícula mais recente). */
    private async dedupeBlockingEnrollments(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            UPDATE enrollments e
            INNER JOIN (
                SELECT course_class_id, student_user_id, MAX(enrolled_at) AS keep_enrolled_at
                FROM enrollments
                WHERE status IN ('ACTIVE', 'PENDING') AND student_user_id IS NOT NULL
                GROUP BY course_class_id, student_user_id
                HAVING COUNT(*) > 1
            ) d
                ON e.course_class_id = d.course_class_id
               AND e.student_user_id = d.student_user_id
            SET e.status = 'CANCELLED', e.updated_at = CURRENT_TIMESTAMP
            WHERE e.status IN ('ACTIVE', 'PENDING')
              AND e.enrolled_at < d.keep_enrolled_at
        `);

        await queryRunner.query(`
            UPDATE enrollments e
            INNER JOIN (
                SELECT course_class_id, dependent_id, MAX(enrolled_at) AS keep_enrolled_at
                FROM enrollments
                WHERE status IN ('ACTIVE', 'PENDING') AND dependent_id IS NOT NULL
                GROUP BY course_class_id, dependent_id
                HAVING COUNT(*) > 1
            ) d
                ON e.course_class_id = d.course_class_id
               AND e.dependent_id = d.dependent_id
            SET e.status = 'CANCELLED', e.updated_at = CURRENT_TIMESTAMP
            WHERE e.status IN ('ACTIVE', 'PENDING')
              AND e.enrolled_at < d.keep_enrolled_at
        `);
    }

    private async backfillSlotKeys(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            UPDATE enrollments
            SET active_class_student_user_key = NULL,
                active_class_dependent_key = NULL
        `);

        await queryRunner.query(`
            UPDATE enrollments
            SET active_class_student_user_key = CONCAT(course_class_id, '|', student_user_id)
            WHERE status IN ('ACTIVE', 'PENDING') AND student_user_id IS NOT NULL
        `);

        await queryRunner.query(`
            UPDATE enrollments
            SET active_class_dependent_key = CONCAT(course_class_id, '|', dependent_id)
            WHERE status IN ('ACTIVE', 'PENDING') AND dependent_id IS NOT NULL
        `);
    }

    public async up(queryRunner: QueryRunner): Promise<void> {
        await this.ensureIndex(queryRunner, 'enrollments', 'idx_enrollments_class', 'course_class_id');
        await this.ensureIndex(queryRunner, 'enrollments', 'idx_enrollments_student_user', 'student_user_id');
        await this.ensureIndex(queryRunner, 'enrollments', 'idx_enrollments_dependent', 'dependent_id');

        if (await this.indexExists(queryRunner, 'enrollments', 'uq_enrollments_class_student_user')) {
            await queryRunner.query(`ALTER TABLE enrollments DROP INDEX uq_enrollments_class_student_user`);
        }
        if (await this.indexExists(queryRunner, 'enrollments', 'uq_enrollments_class_dependent')) {
            await queryRunner.query(`ALTER TABLE enrollments DROP INDEX uq_enrollments_class_dependent`);
        }

        await this.dedupeBlockingEnrollments(queryRunner);

        await this.ensurePlainSlotColumn(queryRunner, 'active_class_student_user_key');
        await this.ensurePlainSlotColumn(queryRunner, 'active_class_dependent_key');

        await this.backfillSlotKeys(queryRunner);

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
            await queryRunner.query(`ALTER TABLE enrollments DROP INDEX uq_enrollments_active_class_student_user`);
        }
        if (await this.indexExists(queryRunner, 'enrollments', 'uq_enrollments_active_class_dependent')) {
            await queryRunner.query(`ALTER TABLE enrollments DROP INDEX uq_enrollments_active_class_dependent`);
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
