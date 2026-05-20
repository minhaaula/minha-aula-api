import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Permite várias solicitações históricas (APPROVED/REJECTED/CANCELLED) por turma+alvo;
 * unicidade só para status PENDING (nova linha a cada rematrícula).
 *
 * Idempotente: se `uq_enrollment_requests_course_target` já foi removido antes, segue normalmente.
 */
export class EnrollmentRequestPartialUniquePending1000000000080 implements MigrationInterface {
    name = 'EnrollmentRequestPartialUniquePending1000000000080';

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
        const fullyMigrated =
            (await queryRunner.hasColumn('enrollment_requests', 'active_pending_target_key')) &&
            (await this.indexExists(queryRunner, 'enrollment_requests', 'uq_enrollment_requests_active_pending_target')) &&
            !(await this.indexExists(queryRunner, 'enrollment_requests', 'uq_enrollment_requests_course_target'));

        if (fullyMigrated) {
            return;
        }

        // FKs usam o UNIQUE antigo como índice — criar índices dedicados antes do DROP.
        await this.ensureIndex(queryRunner, 'enrollment_requests', 'idx_enrollment_requests_class', 'course_class_id');
        await this.ensureIndex(queryRunner, 'enrollment_requests', 'idx_enrollment_requests_user', 'requested_for_user_id');
        await this.ensureIndex(queryRunner, 'enrollment_requests', 'idx_enrollment_requests_dependent', 'requested_for_dependent_id');

        if (await this.indexExists(queryRunner, 'enrollment_requests', 'uq_enrollment_requests_course_target')) {
            await queryRunner.query(`ALTER TABLE enrollment_requests DROP INDEX uq_enrollment_requests_course_target`);
        }

        await queryRunner.query(`
            UPDATE enrollment_requests e
            INNER JOIN (
                SELECT
                    course_class_id,
                    requested_for_user_id,
                    requested_for_dependent_id,
                    MAX(created_at) AS keep_created_at
                FROM enrollment_requests
                WHERE status = 'PENDING'
                GROUP BY course_class_id, requested_for_user_id, requested_for_dependent_id
                HAVING COUNT(*) > 1
            ) d
                ON e.course_class_id = d.course_class_id
               AND e.requested_for_user_id = d.requested_for_user_id
               AND (e.requested_for_dependent_id <=> d.requested_for_dependent_id)
            SET e.status = 'CANCELLED', e.decided_at = CURRENT_TIMESTAMP
            WHERE e.status = 'PENDING' AND e.created_at < d.keep_created_at
        `);

        if (!(await queryRunner.hasColumn('enrollment_requests', 'active_pending_target_key'))) {
            await queryRunner.query(`
                ALTER TABLE enrollment_requests
                ADD COLUMN active_pending_target_key VARCHAR(110) NULL
            `);
        }

        await queryRunner.query(`
            UPDATE enrollment_requests
            SET active_pending_target_key = NULL
            WHERE status <> 'PENDING'
        `);

        await queryRunner.query(`
            UPDATE enrollment_requests
            SET active_pending_target_key = CONCAT(
                course_class_id, '|', requested_for_user_id, '|', IFNULL(requested_for_dependent_id, '')
            )
            WHERE status = 'PENDING'
        `);

        if (!(await this.indexExists(queryRunner, 'enrollment_requests', 'uq_enrollment_requests_active_pending_target'))) {
            await queryRunner.query(`
                CREATE UNIQUE INDEX uq_enrollment_requests_active_pending_target
                ON enrollment_requests (active_pending_target_key)
            `);
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        if (await this.indexExists(queryRunner, 'enrollment_requests', 'uq_enrollment_requests_active_pending_target')) {
            await queryRunner.query(`ALTER TABLE enrollment_requests DROP INDEX uq_enrollment_requests_active_pending_target`);
        }

        if (await queryRunner.hasColumn('enrollment_requests', 'active_pending_target_key')) {
            await queryRunner.query('ALTER TABLE enrollment_requests DROP COLUMN active_pending_target_key');
        }

        if (!(await this.indexExists(queryRunner, 'enrollment_requests', 'uq_enrollment_requests_course_target'))) {
            await queryRunner.query(`
                CREATE UNIQUE INDEX uq_enrollment_requests_course_target
                ON enrollment_requests (course_class_id, requested_for_user_id, requested_for_dependent_id)
            `);
        }
    }
}
