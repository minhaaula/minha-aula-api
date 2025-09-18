import { Payment } from '../../domain/entities/payment';

export interface PaymentRepository {
    findById(id: string): Promise<Payment | null>;
    findByIdempotencyKey(key: string): Promise<Payment | null>;
    save(payment: Payment, opts?: { expectedVersion?: number }): Promise<void>;
    linkIdempotencyKey(paymentId: string, key: string): Promise<void>;
}