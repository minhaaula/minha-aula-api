import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateUserPushTokens1000000000054 implements MigrationInterface {
    name = 'CreateUserPushTokens1000000000054';

    public async up(q: QueryRunner): Promise<void> {
        await q.query(`
            CREATE TABLE IF NOT EXISTS user_push_tokens (
                id CHAR(36) PRIMARY KEY,
                user_id CHAR(36) NOT NULL,
                token VARCHAR(512) NOT NULL,
                platform ENUM('ANDROID','IOS','WEB','UNKNOWN') NOT NULL DEFAULT 'UNKNOWN',
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                last_seen_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                revoked_at DATETIME NULL,
                CONSTRAINT fk_user_push_tokens_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                CONSTRAINT uq_user_push_tokens_token UNIQUE (token)
            ) ENGINE=InnoDB;
        `);

        await q.query(`CREATE INDEX idx_user_push_tokens_user ON user_push_tokens(user_id);`);
        await q.query(`CREATE INDEX idx_user_push_tokens_user_revoked ON user_push_tokens(user_id, revoked_at);`);
    }

    public async down(q: QueryRunner): Promise<void> {
        await q.query(`DROP TABLE IF EXISTS user_push_tokens;`);
    }
}

