import { Column, Entity, PrimaryColumn, VersionColumn, Index, ManyToOne, JoinColumn } from 'typeorm';
import { EnrollmentOrm } from './enrollment.orm';


@Entity('payments')
@Index('idx_payments_enrollment', ['enrollmentId'])
export class PaymentOrm {
    @PrimaryColumn('char', { length: 36 }) id!: string;
    @Column('int') amount!: number;
    @Column('varchar', { length: 3 }) currency!: string;
    @Column('varchar', { length: 16 }) status!: string;
    @Column('varchar', { length: 16 }) method!: string;
    @Index()
    @Column('varchar', { length: 64 }) customer_id!: string;
    @Column('char', { length: 36, name: 'enrollment_id', nullable: true }) enrollmentId!: string | null;
    @Column('json') metadata!: Record<string, string>;
    @Column('varchar', { length: 64, nullable: true }) provider_ref!: string | null;
    @VersionColumn() version!: number;

    @ManyToOne(() => EnrollmentOrm, (enrollment) => enrollment.payments, { nullable: true, onDelete: 'SET NULL' })
    @JoinColumn({ name: 'enrollment_id' })
    enrollment!: EnrollmentOrm | null;
}
