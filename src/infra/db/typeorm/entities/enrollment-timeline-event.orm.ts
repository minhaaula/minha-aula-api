import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { EnrollmentOrm } from './enrollment.orm';
import { UserOrm } from './user.orm';

/** Linha do tempo de eventos da matrícula (progresso, avisos, integrações, etc.). */
@Entity('enrollment_timeline_events')
@Index('idx_enrollment_timeline_events_enrollment_occurred', ['enrollmentId', 'occurredAt'])
export class EnrollmentTimelineEventOrm {
    @PrimaryColumn('char', { length: 36 }) id!: string;

    @Column('char', { length: 36, name: 'enrollment_id' }) enrollmentId!: string;

    @Column('varchar', { length: 64, name: 'event_type' }) eventType!: string;

    @Column('json', { nullable: true }) payload!: Record<string, unknown> | null;

    @Column('datetime', { name: 'occurred_at' }) occurredAt!: Date;

    @Column('char', { length: 36, name: 'actor_user_id', nullable: true }) actorUserId!: string | null;

    @ManyToOne(() => EnrollmentOrm, (enrollment) => enrollment.timelineEvents, { onDelete: 'RESTRICT' })
    @JoinColumn({ name: 'enrollment_id' })
    enrollment!: EnrollmentOrm;

    @ManyToOne(() => UserOrm, { nullable: true, onDelete: 'SET NULL' })
    @JoinColumn({ name: 'actor_user_id' })
    actorUser!: UserOrm | null;

    @CreateDateColumn({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP' }) createdAt!: Date;
}
