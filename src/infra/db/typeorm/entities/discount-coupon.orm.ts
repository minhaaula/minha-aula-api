import { Column, CreateDateColumn, Entity, Index, PrimaryColumn } from 'typeorm';

@Entity('discount_coupons')
@Index(['code'], { unique: true })
export class DiscountCouponOrm {
    @PrimaryColumn('char', { length: 36 }) id!: string;

    @Column('varchar', { length: 50, unique: true }) code!: string;

    @Column('decimal', { precision: 5, scale: 2 }) percentage!: number;

    @Column('date', { name: 'valid_until' }) validUntil!: Date;

    @Column('int', { name: 'duration_months' }) durationMonths!: number;

    @Column('tinyint', { name: 'is_active', width: 1, default: 1 }) isActive!: number;

    @CreateDateColumn({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP' }) createdAt!: Date;

    @Column('datetime', { name: 'deleted_at', nullable: true }) deletedAt!: Date | null;
}

