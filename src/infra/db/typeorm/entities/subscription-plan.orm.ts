import { Column, CreateDateColumn, Entity, OneToMany, PrimaryColumn, UpdateDateColumn } from 'typeorm';
import { SchoolPlanFinanceOrm } from './school-plan-finance.orm';

@Entity('subscription_plans')
export class SubscriptionPlanOrm {
    @PrimaryColumn('char', { length: 36 }) id!: string;

    @Column('varchar', { length: 32, unique: true }) code!: string;

    @Column('varchar', { length: 191 }) name!: string;

    @Column('varchar', { length: 255, nullable: true }) description!: string | null;

    @Column('json', { nullable: true }) items!: string[] | null;

    @Column('int', { name: 'amount_cents' }) amountCents!: number;

    @Column('char', { length: 3 }) currency!: string;

    @Column('enum', { enum: ['MONTHLY', 'ANNUAL'], name: 'billing_cycle', default: 'MONTHLY' })
    billingCycle!: 'MONTHLY' | 'ANNUAL';

    @Column('tinyint', { name: 'is_active', width: 1, default: 1 }) isActive!: number;

    @CreateDateColumn({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
    createdAt!: Date;

    @UpdateDateColumn({
        name: 'updated_at',
        type: 'datetime',
        default: () => 'CURRENT_TIMESTAMP',
        onUpdate: 'CURRENT_TIMESTAMP'
    })
    updatedAt!: Date;

    @OneToMany(() => SchoolPlanFinanceOrm, (finance) => finance.plan)
    finances!: SchoolPlanFinanceOrm[];
}

