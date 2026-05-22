import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { SchoolOrm } from './school.orm';
import { CourseClassOrm } from './course-class.orm';
import { UserOrm } from './user.orm';
import { DependentOrm } from './dependent.orm';
import { EnrollmentOrm } from './enrollment.orm';
import type { TuitionExemptionType } from '../../../../domain/value-objects/tuition-exemption-type';

export type EnrollmentRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';

@Entity('enrollment_requests')
@Index('idx_enrollment_requests_school', ['schoolId'])
@Index('idx_enrollment_requests_class', ['courseClassId'])
@Index('idx_enrollment_requests_user', ['requestedForUserId'])
@Index('idx_enrollment_requests_status', ['status'])
@Index('uq_enrollment_requests_active_pending_target', ['activePendingTargetKey'], { unique: true })
export class EnrollmentRequestOrm {
    @PrimaryColumn('char', { length: 36 }) id!: string;

    @Column('char', { length: 36, name: 'school_id' }) schoolId!: string;

    @Column('char', { length: 36, name: 'course_class_id' }) courseClassId!: string;

    @Column('char', { length: 36, name: 'requested_for_user_id' }) requestedForUserId!: string;

    @Column('char', { length: 36, name: 'requested_for_dependent_id', nullable: true }) requestedForDependentId!: string | null;

    /** Chave única parcial: preenchida apenas enquanto status = PENDING. */
    @Column('varchar', { length: 110, name: 'active_pending_target_key', nullable: true })
    activePendingTargetKey!: string | null;

    @Column('enum', { enum: ['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'], default: 'PENDING' }) status!: EnrollmentRequestStatus;

    @Column('datetime', { name: 'decided_at', nullable: true }) decidedAt!: Date | null;

    @Column('char', { length: 36, name: 'decided_by_user_id', nullable: true }) decidedByUserId!: string | null;

    @Column('varchar', { length: 255, nullable: true }) notes!: string | null;

    @Column('int', { name: 'discount_cents', nullable: true }) discountCents!: number | null;

    @Column('int', { name: 'discount_months', nullable: true }) discountMonths!: number | null;

    @Column('int', { name: 'enrollment_fee_cents', nullable: true }) enrollmentFeeCents!: number | null;

    @Column('date', { name: 'enrollment_fee_due_date', nullable: true }) enrollmentFeeDueDate!: string | null;

    @Column('date', { name: 'first_monthly_payment_date' }) firstMonthlyPaymentDate!: string;

    @Column('enum', {
        enum: ['EMPLOYEE', 'RELATIVE', 'SCHOLARSHIP', 'NONPROFIT'],
        name: 'tuition_exemption_type',
        nullable: true
    })
    tuitionExemptionType!: TuitionExemptionType | null;

    @Column('char', { length: 36, name: 'enrollment_id', nullable: true }) enrollmentId!: string | null;

    @CreateDateColumn({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP' }) createdAt!: Date;

    @ManyToOne(() => SchoolOrm, (school) => school.enrollmentRequests, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'school_id' })
    school!: SchoolOrm;

    @ManyToOne(() => CourseClassOrm, (courseClass) => courseClass.enrollmentRequests, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'course_class_id' })
    courseClass!: CourseClassOrm;

    @ManyToOne(() => UserOrm, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'requested_for_user_id' })
    requestedFor!: UserOrm;

    @ManyToOne(() => DependentOrm, (dependent) => dependent.enrollmentRequests, { nullable: true, onDelete: 'SET NULL' })
    @JoinColumn({ name: 'requested_for_dependent_id' })
    dependent!: DependentOrm | null;

    @ManyToOne(() => UserOrm, { nullable: true, onDelete: 'SET NULL' })
    @JoinColumn({ name: 'decided_by_user_id' })
    decidedBy!: UserOrm | null;

    @ManyToOne(() => EnrollmentOrm, (enrollment) => enrollment.originatingRequests, { nullable: true, onDelete: 'SET NULL' })
    @JoinColumn({ name: 'enrollment_id' })
    resultingEnrollment!: EnrollmentOrm | null;
}
