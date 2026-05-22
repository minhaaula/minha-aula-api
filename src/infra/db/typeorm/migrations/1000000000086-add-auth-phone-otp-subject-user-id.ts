import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddAuthPhoneOtpSubjectUserId1000000000086 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        const table = await queryRunner.getTable('auth_phone_otp_challenges');
        if (!table?.findColumnByName('subject_user_id')) {
            await queryRunner.addColumn(
                'auth_phone_otp_challenges',
                new TableColumn({
                    name: 'subject_user_id',
                    type: 'char',
                    length: '36',
                    isNullable: true
                })
            );
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        const table = await queryRunner.getTable('auth_phone_otp_challenges');
        if (table?.findColumnByName('subject_user_id')) {
            await queryRunner.dropColumn('auth_phone_otp_challenges', 'subject_user_id');
        }
    }
}
