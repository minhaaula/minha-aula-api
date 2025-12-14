import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, OneToMany, PrimaryColumn, UpdateDateColumn } from 'typeorm';
import { CourseClassOrm } from './course-class.orm';
import { UserOrm } from './user.orm';
import { DependentOrm } from './dependent.orm';
import { PaymentOrm } from './payment.orm';
import { EnrollmentRequestOrm } from './enrollment-request.orm';

export type EnrollmentStatus = 'PENDING' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
export type EnrollmentStudentType = 'USER' | 'DEPENDENT';

@Entity('enrollments')
@Index('idx_enrollments_class', ['courseClassId'])
@Index('idx_enrollments_owner', ['ownerUserId'])
@Index('idx_enrollments_student_user', ['studentUserId'])
@Index('idx_enrollments_dependent', ['dependentId'])
@Index('uq_enrollments_class_student_user', ['courseClassId', 'studentUserId'], { unique: true })
@Index('uq_enrollments_class_dependent', ['courseClassId', 'dependentId'], { unique: true })
export class EnrollmentOrm {
    @PrimaryColumn('char', { length: 36 }) id!: string;

    @Column('char', { length: 36, name: 'course_class_id' }) courseClassId!: string;

    @Column('char', { length: 36, name: 'owner_user_id' }) ownerUserId!: string;

    @Column('enum', { enum: ['USER', 'DEPENDENT'], name: 'student_type' }) studentType!: EnrollmentStudentType;

    @Column('char', { length: 36, name: 'student_user_id', nullable: true }) studentUserId!: string | null;

    @Column('char', { length: 36, name: 'dependent_id', nullable: true }) dependentId!: string | null;

    @Column('enum', { enum: ['PENDING', 'ACTIVE', 'COMPLETED', 'CANCELLED'], default: 'ACTIVE' }) status!: EnrollmentStatus;

    @Column('int', { name: 'full_amount_cents', nullable: true }) fullAmountCents!: number | null;

    @Column('tinyint', { width: 2, name: 'payment_due_day', nullable: true }) paymentDueDay!: number | null;

    @CreateDateColumn({ name: 'enrolled_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP' }) enrolledAt!: Date;

    @UpdateDateColumn({ name: 'updated_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP' }) updatedAt!: Date;

    @ManyToOne(() => CourseClassOrm, (courseClass) => courseClass.enrollments, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'course_class_id' })
    courseClass!: CourseClassOrm;

    @ManyToOne(() => UserOrm, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'owner_user_id' })
    owner!: UserOrm;

    @ManyToOne(() => UserOrm, { nullable: true, onDelete: 'SET NULL' })
    @JoinColumn({ name: 'student_user_id' })
    studentUser!: UserOrm | null;

    @ManyToOne(() => DependentOrm, (dependent) => dependent.enrollments, { nullable: true, onDelete: 'SET NULL' })
    @JoinColumn({ name: 'dependent_id' })
    dependent!: DependentOrm | null;

    @OneToMany(() => PaymentOrm, (payment) => payment.enrollment)
    payments!: PaymentOrm[];

    @OneToMany(() => EnrollmentRequestOrm, (request) => request.resultingEnrollment)
    originatingRequests!: EnrollmentRequestOrm[];
}
