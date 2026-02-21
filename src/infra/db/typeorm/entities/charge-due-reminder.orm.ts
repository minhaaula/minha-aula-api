import { Column, CreateDateColumn, Entity, Index, PrimaryColumn } from 'typeorm';

export type ChargeDueReminderType = 'SCHOOL_FINANCIAL_CHARGE' | 'SCHOOL_PLAN_INVOICE';

@Entity('charge_due_reminders')
@Index('uq_charge_due_reminder', ['chargeType', 'chargeId'], { unique: true })
export class ChargeDueReminderOrm {
    @PrimaryColumn('char', { length: 36 }) id!: string;

    @Column('varchar', { length: 32, name: 'charge_type' }) chargeType!: ChargeDueReminderType;

    @Column('char', { length: 36, name: 'charge_id' }) chargeId!: string;

    @CreateDateColumn({ name: 'sent_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP' }) sentAt!: Date;
}
