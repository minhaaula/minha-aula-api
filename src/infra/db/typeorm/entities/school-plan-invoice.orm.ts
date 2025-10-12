import {
    Column,
    CreateDateColumn,
    Entity,
    Index,
    JoinColumn,
    ManyToOne,
    PrimaryColumn,
    UpdateDateColumn
} from 'typeorm';
import { SchoolPlanFinanceOrm } from './school-plan-finance.orm';

@Entity('school_plan_invoices')
@Index('idx_school_plan_invoices_finance_due', ['financeId', 'dueDate'], { unique: true })
@Index('idx_school_plan_invoices_school', ['schoolId'])
export class SchoolPlanInvoiceOrm {
    @PrimaryColumn('char', { length: 36 })
    id!: string;

    @Column('char', { length: 36, name: 'finance_id' })
    financeId!: string;

    @ManyToOne(() => SchoolPlanFinanceOrm, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'finance_id' })
    finance!: SchoolPlanFinanceOrm;

    @Column('char', { length: 36, name: 'school_id' })
    schoolId!: string;

    @Column('char', { length: 36, name: 'plan_id' })
    planId!: string;

    @Column('int', { name: 'amount_cents' })
    amountCents!: number;

    @Column('char', { length: 3 })
    currency!: string;

    @Column('enum', {
        enum: ['ISSUED', 'PAID', 'FAILED', 'CANCELLED'],
        default: 'ISSUED'
    })
    status!: 'ISSUED' | 'PAID' | 'FAILED' | 'CANCELLED';

    @Column('date', { name: 'due_date' })
    dueDate!: string;

    @Column('datetime', { name: 'paid_at', nullable: true })
    paidAt!: Date | null;

    @Column('varchar', { length: 255, nullable: true })
    description!: string | null;

    @Column('varchar', { length: 191, name: 'provider_ref', nullable: true })
    providerRef!: string | null;

    @Column('varchar', { length: 255, name: 'boleto_url', nullable: true })
    boletoUrl!: string | null;

    @Column('varchar', { length: 255, name: 'digitable_line', nullable: true })
    digitableLine!: string | null;

    @Column('varchar', { length: 255, nullable: true })
    barcode!: string | null;

    @Column('varchar', { length: 255, name: 'external_reference', nullable: true })
    externalReference!: string | null;

    @Column('json', { nullable: true })
    metadata!: Record<string, string> | null;

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
