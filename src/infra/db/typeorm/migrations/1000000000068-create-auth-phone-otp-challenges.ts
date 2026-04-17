import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class CreateAuthPhoneOtpChallenges1000000000068 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.createTable(new Table({
            name: 'auth_phone_otp_challenges',
            columns: [
                { name: 'id', type: 'char', length: '36', isPrimary: true },
                { name: 'purpose', type: 'varchar', length: '32' },
                { name: 'code', type: 'varchar', length: '8' },
                { name: 'phone', type: 'varchar', length: '24' },
                { name: 'email', type: 'varchar', length: '255', isNullable: true },
                { name: 'expires_at', type: 'datetime' },
                { name: 'attempts_used', type: 'int', default: '0' },
                { name: 'max_attempts', type: 'int', default: '5' },
                { name: 'verified_at', type: 'datetime', isNullable: true },
                { name: 'consumed_at', type: 'datetime', isNullable: true },
                { name: 'created_at', type: 'datetime', default: 'CURRENT_TIMESTAMP' },
                { name: 'twilio_verification_sid', type: 'varchar', length: '64', isNullable: true }
            ]
        }));

        await queryRunner.createIndex('auth_phone_otp_challenges', new TableIndex({
            name: 'idx_auth_phone_otp_purpose_phone_created',
            columnNames: ['purpose', 'phone', 'created_at']
        }));
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.dropIndex('auth_phone_otp_challenges', 'idx_auth_phone_otp_purpose_phone_created');
        await queryRunner.dropTable('auth_phone_otp_challenges');
    }
}
