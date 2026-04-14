import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddTwilioVerificationSidToSchoolActionOtps1000000000063 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.addColumn(
            'school_action_otps',
            new TableColumn({
                name: 'twilio_verification_sid',
                type: 'varchar',
                length: '64',
                isNullable: true
            })
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.dropColumn('school_action_otps', 'twilio_verification_sid');
    }
}
