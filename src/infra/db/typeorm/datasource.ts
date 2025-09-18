import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { PaymentOrm } from './entities/payment.orm';
import { OutboxOrm } from './entities/outbox.orm';
import { IdempotencyOrm } from './entities/idempotency.orm';

export const AppDataSource = new DataSource({
    type: 'mysql',
    host: process.env.DB_HOST,
    port: +(process.env.DB_PORT ?? 3306),
    username: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
    entities: [PaymentOrm, OutboxOrm, IdempotencyOrm],
    synchronize: false,
    migrations: ['dist/infra/db/typeorm/migrations/*.js'],
    extra: { decimalNumbers: true }
});