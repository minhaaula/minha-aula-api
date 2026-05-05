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
import { SchoolOrm } from './school.orm';
import { UserOrm } from './user.orm';
import { DependentOrm } from './dependent.orm';
import { CourseOrm } from './course.orm';
import { CourseClassOrm } from './course-class.orm';
import { SchoolFinancialChargeStatus, SchoolFinancialChargeType } from '../../../../domain/entities/school-financial-charge';

@Entity('school_financial_charges')
@Index('idx_school_financial_charges_school', ['schoolId'])
@Index('idx_school_financial_charges_status', ['status'])
@Index('idx_school_financial_charges_due_date', ['dueDate'])
@Index('idx_school_financial_charges_student', ['studentUserId'])
export class SchoolFinancialChargeOrm {
    @PrimaryColumn('char', { length: 36 }) id!: string;

    @Column('char', { length: 36, name: 'school_id' }) schoolId!: string;

    @Column('char', { length: 36, name: 'owner_user_id' }) ownerUserId!: string;

    @Column('char', { length: 36, name: 'student_user_id', nullable: true }) studentUserId!: string | null;

    @Column('char', { length: 36, name: 'dependent_id', nullable: true }) dependentId!: string | null;

    @Column('char', { length: 36, name: 'course_id' }) courseId!: string;

    @Column('char', { length: 36, name: 'course_class_id', nullable: true }) courseClassId!: string | null;

    @Column('enum', {
        enum: ['TUITION', 'ENROLLMENT', 'MATERIALS', 'DAILY', 'OTHER'],
        name: 'charge_type'
    })
    chargeType!: SchoolFinancialChargeType;

    @Column('varchar', { length: 255, nullable: true }) description!: string | null;

    @Column('int', { name: 'amount_cents' }) amountCents!: number;

    @Column('int', { name: 'discount_cents', nullable: true }) discountCents!: number | null;

    @Column('varchar', { length: 255, name: 'discount_reason', nullable: true })
    discountReason!: string | null;

    @Column('int', { name: 'net_amount_cents' }) netAmountCents!: number;

    /** Valor líquido retornado pelo provedor (ex.: Asaas `netValue`), em centavos. */
    @Column('int', { name: 'provider_net_amount_cents', nullable: true })
    providerNetAmountCents!: number | null;

    @Column('date', { name: 'due_date' }) dueDate!: Date;

    @Column('enum', {
        enum: ['PENDING_SYNC', 'OPEN', 'PAID', 'OVERDUE', 'CANCELLED', 'FAILED'],
        default: 'PENDING_SYNC'
    })
    status!: SchoolFinancialChargeStatus;

    @Column('varchar', { length: 191, name: 'asaas_payment_id', nullable: true })
    asaasPaymentId!: string | null;

    @Column('varchar', { length: 512, name: 'asaas_invoice_url', nullable: true })
    asaasInvoiceUrl!: string | null;

    @Column('json', { name: 'asaas_payload', nullable: true })
    asaasPayload!: Record<string, unknown> | null;

    @Column('datetime', { name: 'paid_at', nullable: true })
    paidAt!: Date | null;

    @Column('varchar', { name: 'payment_method', length: 20, nullable: true })
    paymentMethod!: 'PIX' | 'BOLETO' | 'MANUAL' | null;

    @Column('varchar', { name: 'paid_observation', length: 500, nullable: true })
    paidObservation!: string | null;

    @Column('datetime', { name: 'cancelled_at', nullable: true })
    cancelledAt!: Date | null;

    @CreateDateColumn({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
    createdAt!: Date;

    @UpdateDateColumn({ name: 'updated_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
    updatedAt!: Date;

    @ManyToOne(() => SchoolOrm, (school) => school.financialCharges, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'school_id' })
    school!: SchoolOrm;

    @ManyToOne(() => UserOrm, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'owner_user_id' })
    ownerUser!: UserOrm;

    @ManyToOne(() => UserOrm, { nullable: true, onDelete: 'SET NULL' })
    @JoinColumn({ name: 'student_user_id' })
    student!: UserOrm | null;

    @ManyToOne(() => DependentOrm, { nullable: true, onDelete: 'SET NULL' })
    @JoinColumn({ name: 'dependent_id' })
    dependent!: DependentOrm | null;

    @ManyToOne(() => CourseOrm, (course) => course.financialCharges, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'course_id' })
    course!: CourseOrm;

    @ManyToOne(() => CourseClassOrm, (courseClass) => courseClass.financialCharges, { nullable: true, onDelete: 'SET NULL' })
    @JoinColumn({ name: 'course_class_id' })
    courseClass!: CourseClassOrm | null;
}
