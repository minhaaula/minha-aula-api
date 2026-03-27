import { MigrationInterface, QueryRunner } from 'typeorm';

const MYSQL_DUP_FIELDNAME = 1060;

function isMysqlDuplicateColumnName(e: unknown): boolean {
    if (e === null || typeof e !== 'object') return false;
    const o = e as { errno?: number; driverError?: { errno?: number }; code?: string };
    const errno = o.driverError?.errno ?? o.errno;
    return errno === MYSQL_DUP_FIELDNAME || o.code === 'ER_DUP_FIELDNAME';
}

export class AddCourseClassSchedule1000000000015 implements MigrationInterface {
    name = 'AddCourseClassSchedule1000000000015'

    public async up(queryRunner: QueryRunner): Promise<void> {
        const hasShift = await queryRunner.query(`
            SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'course_classes' AND COLUMN_NAME = 'shift';
        `);

        try {
            await queryRunner.query(`
                ALTER TABLE course_classes
                ADD COLUMN schedule JSON NULL AFTER label
            `);
        } catch (e) {
            if (!isMysqlDuplicateColumnName(e)) {
                throw e;
            }
        }

        if (hasShift.length > 0) {
            await queryRunner.query(`
                UPDATE course_classes
                SET schedule = JSON_ARRAY(
                    JSON_OBJECT(
                        'day', COALESCE(shift, 'A definir'),
                        'start', COALESCE(DATE_FORMAT(starts_at, '%H:%i'), '08:00'),
                        'end', COALESCE(DATE_FORMAT(ends_at, '%H:%i'), '09:00')
                    )
                )
            `);

            await queryRunner.query(`
                UPDATE course_classes
                SET schedule = JSON_ARRAY(
                    JSON_OBJECT(
                        'day', 'A definir',
                        'start', '08:00',
                        'end', '09:00'
                    )
                )
                WHERE JSON_LENGTH(schedule) = 0
                   OR schedule IS NULL
            `);
        }

        const scheduleNullable = await queryRunner.query(`
            SELECT IS_NULLABLE FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'course_classes' AND COLUMN_NAME = 'schedule';
        `);
        if (scheduleNullable.length > 0 && scheduleNullable[0].IS_NULLABLE === 'YES') {
            await queryRunner.query(`
                ALTER TABLE course_classes
                MODIFY COLUMN schedule JSON NOT NULL
            `);
        }

        if (hasShift.length > 0) {
            await queryRunner.query(`
                ALTER TABLE course_classes
                DROP COLUMN shift,
                DROP COLUMN starts_at,
                DROP COLUMN ends_at
            `);
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE course_classes
            ADD COLUMN shift VARCHAR(64) NULL AFTER label,
            ADD COLUMN starts_at DATETIME NULL AFTER capacity,
            ADD COLUMN ends_at DATETIME NULL AFTER starts_at
        `);

        await queryRunner.query(`
            UPDATE course_classes
            SET
                shift = JSON_UNQUOTE(JSON_EXTRACT(schedule, '$[0].day')),
                starts_at = STR_TO_DATE(
                    CONCAT('1970-01-01 ', JSON_UNQUOTE(JSON_EXTRACT(schedule, '$[0].start'))),
                    '%Y-%m-%d %H:%i'
                ),
                ends_at = STR_TO_DATE(
                    CONCAT('1970-01-01 ', JSON_UNQUOTE(JSON_EXTRACT(schedule, '$[0].end'))),
                    '%Y-%m-%d %H:%i'
                )
        `);

        await queryRunner.query(`
            ALTER TABLE course_classes
            DROP COLUMN schedule
        `);
    }
}
