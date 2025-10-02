import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { SchoolOrm } from './school.orm';

@Entity('school_addresses')
export class SchoolAddressOrm {
    @PrimaryColumn('char', { length: 36 }) id!: string;

    @Column('varchar', { length: 191 }) street!: string;

    @Column('varchar', { length: 32 }) number!: string;

    @Column('varchar', { length: 191, nullable: true }) complement!: string | null;

    @Column('varchar', { length: 128, nullable: true }) district!: string | null;

    @Column('varchar', { length: 128 }) city!: string;

    @Column('varchar', { length: 64 }) state!: string;

    @Column('varchar', { length: 16, name: 'zip_code' }) zipCode!: string;

    @CreateDateColumn({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP' }) createdAt!: Date;

    @ManyToOne(() => SchoolOrm, (school) => school.addresses, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'school_id' })
    school!: SchoolOrm;
}
