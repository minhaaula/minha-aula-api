import { MigrationInterface, QueryRunner } from 'typeorm';

export class EnrollmentCertificateStatus1000000000077 implements MigrationInterface {
    name = 'EnrollmentCertificateStatus1000000000077';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE enrollment_promotion_certificates
            ADD COLUMN status VARCHAR(16) NOT NULL DEFAULT 'PENDING' AFTER certificate_template_id;
        `);
        await queryRunner.query(`
            UPDATE enrollment_promotion_certificates
            SET status = CASE
                WHEN document_url IS NOT NULL AND document_url != '' THEN 'GENERATED'
                ELSE 'PENDING'
            END;
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE enrollment_promotion_certificates
            DROP COLUMN status;
        `);
    }
}
