import { Column, Entity, PrimaryColumn } from 'typeorm';

export type EventLogStatusOrm = 'completed' | 'failed';

@Entity('event_logs')
export class EventLogOrm {
    @PrimaryColumn('char', { length: 36 })
    id!: string;

    @Column('varchar', { length: 128 })
    type!: string;

    @Column('varchar', { length: 191, nullable: true })
    recipient!: string | null;

    @Column('datetime', { name: 'dispatched_at' })
    dispatchedAt!: Date;

    @Column('varchar', { length: 16 })
    status!: EventLogStatusOrm;

    @Column('json', { nullable: true })
    payload!: Record<string, unknown> | null;

    @Column('mediumtext', { name: 'error_message', nullable: true })
    errorMessage!: string | null;
}

