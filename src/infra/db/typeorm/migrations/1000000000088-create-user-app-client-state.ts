import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateUserAppClientState1000000000088 implements MigrationInterface {
    name = 'CreateUserAppClientState1000000000088';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE user_app_client_state (
                user_id CHAR(36) NOT NULL,
                platform ENUM('ANDROID', 'IOS') NOT NULL,
                app_version VARCHAR(32) NOT NULL,
                os_version VARCHAR(64) NOT NULL,
                notifications_enabled TINYINT(1) NOT NULL DEFAULT 0,
                last_seen_at DATETIME NOT NULL,
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                PRIMARY KEY (user_id),
                CONSTRAINT fk_user_app_client_state_user
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE IF EXISTS user_app_client_state`);
    }
}
