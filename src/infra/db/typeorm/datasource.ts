import 'dotenv/config';
import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { PaymentOrm } from './entities/payment.orm';
import { OutboxOrm } from './entities/outbox.orm';
import { IdempotencyOrm } from './entities/idempotency.orm';
import { UserOrm } from './entities/user.orm';
import { SchoolOrm } from './entities/school.orm';
import { CourseOrm } from './entities/course.orm';
import { CourseClassOrm } from './entities/course-class.orm';
import { DependentOrm } from './entities/dependent.orm';
import { EnrollmentOrm } from './entities/enrollment.orm';
import { NotificationOrm } from './entities/notification.orm';
import { EnrollmentRequestOrm } from './entities/enrollment-request.orm';

export const AppDataSource = new DataSource({
    type: 'mysql',
    host: process.env.DB_HOST,
    port: +(process.env.DB_PORT ?? 3306),
    username: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
    entities: [
        PaymentOrm,
        OutboxOrm,
        IdempotencyOrm,
        UserOrm,
        SchoolOrm,
        CourseOrm,
        CourseClassOrm,
        DependentOrm,
        EnrollmentOrm,
        NotificationOrm,
        EnrollmentRequestOrm
    ],
    synchronize: false,
    migrations: ['dist/infra/db/typeorm/migrations/*.js'],
    extra: { decimalNumbers: true }
});
