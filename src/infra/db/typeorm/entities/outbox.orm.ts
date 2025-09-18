import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';


@Entity('outbox')
export class OutboxOrm {
    @PrimaryGeneratedColumn('increment') id!: number;
    @Column('varchar', { length: 64 }) type!: string;
    @Column('char', { length: 36 }) aggregate_id!: string;
    @Column('json') payload_json!: unknown;
    @Column('timestamp', { default: () => 'CURRENT_TIMESTAMP' }) created_at!: Date;
    @Column('timestamp', { nullable: true }) processed_at!: Date | null;
}