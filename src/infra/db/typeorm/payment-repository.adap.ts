import { Payment } from "../../../domain/entities/payment";
import { PaymentOrm } from "./entities/payment.orm";
import { Money } from "../../../domain/value-objects/money";
import { AppDataSource } from "./datasource";
import { PaymentRepository } from "../../../ports/repositories/payment.repo";

export class PaymentRepositoryAdapter implements PaymentRepository {
    private repo = AppDataSource.getRepository(PaymentOrm);


    async findById(id: string): Promise<Payment | null> {
        const row = await this.repo.findOne({ where: { id } });
        return row ? this.toDomain(row) : null;
    }

    async findByIdempotencyKey(key: string): Promise<Payment | null> {
        const r = await AppDataSource.query(
            'SELECT p.* FROM idempotency i JOIN payments p ON p.id = i.payment_id WHERE i.`key` = ? LIMIT 1', 
            [key]
        );
        return r?.[0] ? this.toDomain(r[0] as PaymentOrm) : null;
    }

    async save(entity: Payment, opts?: { expectedVersion?: number }): Promise<void> {
        if (opts?.expectedVersion !== undefined) {
        const curr = await this.repo.findOneByOrFail({ id: entity.id });
        if (curr.version !== opts.expectedVersion) throw new Error('OptimisticLockError');
        }
        await this.repo.save(this.toOrm(entity));
    }

    async linkIdempotencyKey(paymentId: string, key: string): Promise<void> {
        await AppDataSource.query('INSERT IGNORE INTO idempotency (`key`, payment_id) VALUES (?, ?)', [key, paymentId]);
    }

    private toDomain(r: PaymentOrm): Payment {
        const p = Payment.create({ id: r.id, amount: Money.of(r.amount, r.currency), method: r.method as any, customerId: r.customer_id, metadata: r.metadata });
        (p as any).providerRef = r.provider_ref;
        (p as any)._status = r.status;
        p.version = r.version;
        return p;
    }

    private toOrm(p: Payment): PaymentOrm {
        const row = new PaymentOrm();
        row.id = p.id; row.amount = p.amount.amount; row.currency = p.amount.currency; row.method = p.method; row.status = p.status; row.customer_id = p.customerId; row.metadata = p.metadata; row.version = p.version; row.provider_ref = p.providerRef ?? null;
        return row;
    }
}
