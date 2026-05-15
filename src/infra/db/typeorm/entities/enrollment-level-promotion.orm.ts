import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { EnrollmentOrm } from './enrollment.orm';
import { SchoolStudentLevelOrm } from './school-student-level.orm';
import { UserOrm } from './user.orm';

/** Registro imutável de mudança de nível sempre atrelado a uma matrícula (nunca a um “nível global” do usuário). */
@Entity('enrollment_level_promotions')
@Index('idx_enrollment_level_promotions_enrollment', ['enrollmentId'])
@Index('idx_enrollment_level_promotions_promoted_at', ['enrollmentId', 'promotedAt'])
export class EnrollmentLevelPromotionOrm {
    @PrimaryColumn('char', { length: 36 }) id!: string;

    @Column('char', { length: 36, name: 'enrollment_id' }) enrollmentId!: string;

    @Column('char', { length: 36, name: 'from_level_id', nullable: true }) fromLevelId!: string | null;

    @Column('char', { length: 36, name: 'to_level_id', nullable: true }) toLevelId!: string | null;

    /** Snapshot do rótulo de origem caso o nível configurado seja renomeado ou removido. */
    @Column('varchar', { length: 191, name: 'from_level_label_snapshot', nullable: true })
    fromLevelLabelSnapshot!: string | null;

    @Column('varchar', { length: 191, name: 'to_level_label_snapshot', nullable: true }) toLevelLabelSnapshot!: string | null;

    @Column('int', { name: 'from_level_sort_order_snapshot', nullable: true }) fromLevelSortOrderSnapshot!: number | null;

    @Column('int', { name: 'to_level_sort_order_snapshot', nullable: true }) toLevelSortOrderSnapshot!: number | null;

    @Column('datetime', { name: 'promoted_at', default: () => 'CURRENT_TIMESTAMP' }) promotedAt!: Date;

    @Column('text', { nullable: true }) notes!: string | null;

    @Column('char', { length: 36, name: 'created_by_user_id', nullable: true }) createdByUserId!: string | null;

    @ManyToOne(() => EnrollmentOrm, (enrollment) => enrollment.levelPromotions, { onDelete: 'RESTRICT' })
    @JoinColumn({ name: 'enrollment_id' })
    enrollment!: EnrollmentOrm;

    @ManyToOne(() => SchoolStudentLevelOrm, { nullable: true, onDelete: 'SET NULL' })
    @JoinColumn({ name: 'from_level_id' })
    fromLevel!: SchoolStudentLevelOrm | null;

    @ManyToOne(() => SchoolStudentLevelOrm, { nullable: true, onDelete: 'SET NULL' })
    @JoinColumn({ name: 'to_level_id' })
    toLevel!: SchoolStudentLevelOrm | null;

    @ManyToOne(() => UserOrm, { nullable: true, onDelete: 'SET NULL' })
    @JoinColumn({ name: 'created_by_user_id' })
    createdByUser!: UserOrm | null;

    @CreateDateColumn({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP' }) createdAt!: Date;
}
