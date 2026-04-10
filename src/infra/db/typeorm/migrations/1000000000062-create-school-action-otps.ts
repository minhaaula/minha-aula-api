import { MigrationInterface, QueryRunner, Table, TableForeignKey, TableIndex } from 'typeorm';

export class CreateSchoolActionOtps1000000000062 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.createTable(new Table({
            name: 'school_action_otps',
            columns: [
                { name: 'id', type: 'char', length: '36', isPrimary: true },
                { name: 'school_id', type: 'char', length: '36' },
                { name: 'purpose', type: 'varchar', length: '32' },
                { name: 'code', type: 'varchar', length: '8' },
                { name: 'phone', type: 'varchar', length: '20' },
                { name: 'expires_at', type: 'datetime' },
                { name: 'attempts_used', type: 'int', default: '0' },
                { name: 'max_attempts', type: 'int', default: '5' },
                { name: 'verified_at', type: 'datetime', isNullable: true },
                { name: 'consumed_at', type: 'datetime', isNullable: true },
                { name: 'created_at', type: 'datetime', default: 'CURRENT_TIMESTAMP' }
            ]
        }));

        await queryRunner.createForeignKey('school_action_otps', new TableForeignKey({
            columnNames: ['school_id'],
            referencedTableName: 'schools',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE'
        }));

        await queryRunner.createIndex('school_action_otps', new TableIndex({
            name: 'idx_school_action_otps_school_purpose_created',
            columnNames: ['school_id', 'purpose', 'created_at']
        }));
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.dropIndex('school_action_otps', 'idx_school_action_otps_school_purpose_created');
        const table = await queryRunner.getTable('school_action_otps');
        const foreignKey = table?.foreignKeys.find((item) => item.columnNames.includes('school_id'));
        if (foreignKey) {
            await queryRunner.dropForeignKey('school_action_otps', foreignKey);
        }
        await queryRunner.dropTable('school_action_otps');
    }
}
