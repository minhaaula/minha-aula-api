import {
    Column,
    CreateDateColumn,
    Entity,
    Index,
    JoinColumn,
    ManyToOne,
    OneToOne,
    PrimaryColumn,
    UpdateDateColumn
} from 'typeorm';
import { SubscriptionPlanOrm } from './subscription-plan.orm';
import { SchoolOrm } from './school.orm';

@Entity('school_plan_finances')
@Index('idx_school_plan_finances_plan', ['planId'])
export class SchoolPlanFinanceOrm {
    @PrimaryColumn('char', { length: 36 }) id!: string;

    @Column('char', { length: 36, name: 'school_id', unique: true })
    schoolId!: string;

    @OneToOne(() => SchoolOrm, (school) => school.planFinance, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'school_id' })
    school!: SchoolOrm;

    @Column('char', { length: 36, name: 'plan_id' })
    planId!: string;

    @ManyToOne(() => SubscriptionPlanOrm, (plan) => plan.finances, { onDelete: 'RESTRICT' })
    @JoinColumn({ name: 'plan_id' })
    plan!: SubscriptionPlanOrm;

    @Column('enum', {
        enum: ['TRIAL', 'ACTIVE', 'PAST_DUE', 'SUSPENDED', 'CANCELLED'],
        default: 'ACTIVE'
    })
    status!: 'TRIAL' | 'ACTIVE' | 'PAST_DUE' | 'SUSPENDED' | 'CANCELLED';

    @Column('tinyint', { name: 'is_paid', width: 1, default: 0 })
    isPaid!: number;

    @Column('datetime', { name: 'last_payment_at', nullable: true })
    lastPaymentAt!: Date | null;

    @Column('datetime', { name: 'next_due_at', nullable: true })
    nextDueAt!: Date | null;

    @Column('varchar', { length: 255, nullable: true })
    notes!: string | null;

    @CreateDateColumn({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
    createdAt!: Date;

    @UpdateDateColumn({
        name: 'updated_at',
        type: 'datetime',
        default: () => 'CURRENT_TIMESTAMP',
        onUpdate: 'CURRENT_TIMESTAMP'
    })
    updatedAt!: Date;
}

