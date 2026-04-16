import { Column, Entity, PrimaryColumn } from 'typeorm';

export type CronLogStatusOrm = 'completed' | 'failed';

@Entity('cron_logs')
export class CronLogOrm {
    @PrimaryColumn('char', { length: 36 })
    id!: string;

    @Column('varchar', { length: 128, name: 'cron_name' })
    cronName!: string;

    @Column('datetime', { name: 'started_at' })
    startedAt!: Date;

    @Column('datetime', { name: 'finished_at' })
    finishedAt!: Date;

    @Column('varchar', { length: 16 })
    status!: CronLogStatusOrm;

    @Column('mediumtext', { name: 'error_message', nullable: true })
    errorMessage!: string | null;
}

