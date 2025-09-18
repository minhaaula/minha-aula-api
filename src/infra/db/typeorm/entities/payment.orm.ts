import { Column, Entity, PrimaryColumn, VersionColumn, Index } from 'typeorm';


@Entity('payments')
export class PaymentOrm {
    @PrimaryColumn('char', { length: 36 }) id!: string;
    @Column('int') amount!: number;
    @Column('varchar', { length: 3 }) currency!: string;
    @Column('varchar', { length: 16 }) status!: string;
    @Column('varchar', { length: 16 }) method!: string;
    @Index()
    @Column('varchar', { length: 64 }) customer_id!: string;
    @Column('json') metadata!: Record<string, string>;
    @Column('varchar', { length: 64, nullable: true }) provider_ref!: string | null;
    @VersionColumn() version!: number;
}