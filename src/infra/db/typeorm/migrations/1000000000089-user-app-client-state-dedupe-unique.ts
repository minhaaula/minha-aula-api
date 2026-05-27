import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Garante 1 linha por usuário em user_app_client_state (dedupe + PK em user_id).
 * Idempotente: seguro se a tabela já estiver correta após a migration 0088.
 */
export class UserAppClientStateDedupeUnique1000000000089 implements MigrationInterface {
    name = 'UserAppClientStateDedupeUnique1000000000089';

    public async up(queryRunner: QueryRunner): Promise<void> {
        const hasTable = await queryRunner.hasTable('user_app_client_state');
        if (!hasTable) {
            return;
        }

        await queryRunner.query(`
            UPDATE user_app_client_state
            SET user_id = TRIM(user_id)
            WHERE user_id <> TRIM(user_id)
        `);

        await queryRunner.query(`
            DELETE t1 FROM user_app_client_state t1
            INNER JOIN user_app_client_state t2
                ON t1.user_id = t2.user_id
                AND (
                    t1.last_seen_at < t2.last_seen_at
                    OR (
                        t1.last_seen_at = t2.last_seen_at
                        AND t1.updated_at < t2.updated_at
                    )
                    OR (
                        t1.last_seen_at = t2.last_seen_at
                        AND t1.updated_at = t2.updated_at
                        AND t1.user_id > t2.user_id
                    )
                )
        `);

        const pkRows: Array<{ cnt: number }> = await queryRunner.query(`
            SELECT COUNT(*) AS cnt
            FROM information_schema.table_constraints
            WHERE table_schema = DATABASE()
              AND table_name = 'user_app_client_state'
              AND constraint_type = 'PRIMARY KEY'
        `);
        const hasPrimaryKey = Number(pkRows[0]?.cnt ?? 0) > 0;
        if (!hasPrimaryKey) {
            await queryRunner.query(`
                ALTER TABLE user_app_client_state
                    ADD PRIMARY KEY (user_id)
            `);
        }
    }

    public async down(_queryRunner: QueryRunner): Promise<void> {
        // Sem reversão: dedupe e PK não devem ser desfeitos.
    }
}
