import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, OneToMany, PrimaryColumn, UpdateDateColumn } from 'typeorm';
import { CourseClassOrm } from './course-class.orm';
import { UserOrm } from './user.orm';
import { DependentOrm } from './dependent.orm';
import { PaymentOrm } from './payment.orm';
import { EnrollmentRequestOrm } from './enrollment-request.orm';
import { SchoolStudentLevelOrm } from './school-student-level.orm';
import { EnrollmentLevelPromotionOrm } from './enrollment-level-promotion.orm';
import { EnrollmentPromotionCertificateOrm } from './enrollment-promotion-certificate.orm';
import { EnrollmentTimelineEventOrm } from './enrollment-timeline-event.orm';

export type EnrollmentStatus = 'PENDING' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
export type EnrollmentStudentType = 'USER' | 'DEPENDENT';

@Entity('enrollments')
@Index('idx_enrollments_class', ['courseClassId'])
@Index('idx_enrollments_owner', ['ownerUserId'])
@Index('idx_enrollments_student_user', ['studentUserId'])
@Index('idx_enrollments_dependent', ['dependentId'])
@Index('uq_enrollments_active_class_student_user', ['activeClassStudentUserKey'], { unique: true })
@Index('uq_enrollments_active_class_dependent', ['activeClassDependentKey'], { unique: true })
export class EnrollmentOrm {
    @PrimaryColumn('char', { length: 36 }) id!: string;

    @Column('char', { length: 36, name: 'course_class_id' }) courseClassId!: string;

    @Column('char', { length: 36, name: 'owner_user_id' }) ownerUserId!: string;

    @Column('enum', { enum: ['USER', 'DEPENDENT'], name: 'student_type' }) studentType!: EnrollmentStudentType;

    @Column('char', { length: 36, name: 'student_user_id', nullable: true }) studentUserId!: string | null;

    @Column('char', { length: 36, name: 'dependent_id', nullable: true }) dependentId!: string | null;

    /** Chave única gerada só para matrículas ACTIVE/PENDING (titular). */
    @Column({
        type: 'varchar',
        length: 73,
        name: 'active_class_student_user_key',
        nullable: true,
        insert: false,
        update: false,
        asExpression: `IF(status IN ('ACTIVE','PENDING') AND student_user_id IS NOT NULL, CONCAT(course_class_id, '|', student_user_id), NULL)`,
        generatedType: 'STORED'
    })
    activeClassStudentUserKey!: string | null;

    /** Chave única gerada só para matrículas ACTIVE/PENDING (dependente). */
    @Column({
        type: 'varchar',
        length: 73,
        name: 'active_class_dependent_key',
        nullable: true,
        insert: false,
        update: false,
        asExpression: `IF(status IN ('ACTIVE','PENDING') AND dependent_id IS NOT NULL, CONCAT(course_class_id, '|', dependent_id), NULL)`,
        generatedType: 'STORED'
    })
    activeClassDependentKey!: string | null;

    @Column('enum', { enum: ['PENDING', 'ACTIVE', 'COMPLETED', 'CANCELLED'], default: 'ACTIVE' }) status!: EnrollmentStatus;

    @Column('int', { name: 'full_amount_cents', nullable: true }) fullAmountCents!: number | null;

    @Column('tinyint', { width: 2, name: 'payment_due_day', nullable: true }) paymentDueDay!: number | null;

    @CreateDateColumn({ name: 'enrolled_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP' }) enrolledAt!: Date;

    @UpdateDateColumn({ name: 'updated_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP' }) updatedAt!: Date;

    /**
     * Nível atual opcional nesta matrícula; `null` quando a escola não usa o módulo de níveis ou ainda não houve promoção.
     * Não existe estado de nível fora da matrícula.
     */
    @Column('char', { length: 36, name: 'current_school_student_level_id', nullable: true })
    currentSchoolStudentLevelId!: string | null;

    @ManyToOne(() => SchoolStudentLevelOrm, { nullable: true, onDelete: 'SET NULL' })
    @JoinColumn({ name: 'current_school_student_level_id' })
    currentSchoolStudentLevel!: SchoolStudentLevelOrm | null;

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

    @OneToMany(() => EnrollmentLevelPromotionOrm, (promotion) => promotion.enrollment)
    levelPromotions!: EnrollmentLevelPromotionOrm[];

    @OneToMany(() => EnrollmentPromotionCertificateOrm, (cert) => cert.enrollment)
    promotionCertificates!: EnrollmentPromotionCertificateOrm[];

    @OneToMany(() => EnrollmentTimelineEventOrm, (event) => event.enrollment)
    timelineEvents!: EnrollmentTimelineEventOrm[];
}
