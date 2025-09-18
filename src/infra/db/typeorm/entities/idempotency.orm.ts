import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity('idempotency')
export class IdempotencyOrm {
    @PrimaryColumn('varchar', { length: 128 }) key!: string;
    @Column('char', { length: 36 }) payment_id!: string;
    @Column('timestamp', { default: () => 'CURRENT_TIMESTAMP' }) created_at!: Date;
}
