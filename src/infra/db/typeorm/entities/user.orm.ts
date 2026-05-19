import { Column, CreateDateColumn, Entity, Index, OneToMany, PrimaryColumn } from 'typeorm';
import { SchoolOrm } from './school.orm';

@Entity('users')
@Index(['email'], { unique: true })
@Index(['cpf'], { unique: true })
export class UserOrm {
    @PrimaryColumn('char', { length: 36 }) id!: string;
    @Column('varchar', { length: 191, name: 'full_name' }) fullName!: string;
    @Column('date', { name: 'birth_date' }) birthDate!: Date;
    @Column('varchar', { length: 191 }) email!: string;
    @Column('varchar', { length: 32 }) phone!: string;
    @Column('char', { length: 11 }) cpf!: string;
    @Column('varchar', { length: 191, name: 'address_street' }) addressStreet!: string;
    @Column('varchar', { length: 32, name: 'address_number' }) addressNumber!: string;
    @Column('varchar', { length: 191, name: 'address_complement', nullable: true }) addressComplement!: string | null;
    @Column('varchar', { length: 128, name: 'address_district', nullable: true }) addressDistrict!: string | null;
    @Column('varchar', { length: 128, name: 'address_city' }) addressCity!: string;
    @Column('varchar', { length: 64, name: 'address_state' }) addressState!: string;
    @Column('varchar', { length: 16, name: 'address_zip_code' }) addressZipCode!: string;
    @Column('varchar', { length: 16 }) persona!: string;
    @Column('varchar', { length: 255, name: 'password_hash' }) passwordHash!: string;
    @Column('varchar', { length: 500, name: 'photo_url', nullable: true }) photoUrl!: string | null;
    @Column('tinyint', { name: 'active', default: 1 }) active!: number;
    @Column('varchar', { length: 64, name: 'deactivation_reason', nullable: true }) deactivationReason!: string | null;
    @Column('text', { name: 'deactivation_description', nullable: true }) deactivationDescription!: string | null;
    @Column('datetime', { name: 'deleted_at', nullable: true }) deletedAt!: Date | null;
    @CreateDateColumn({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP' }) createdAt!: Date;

    @OneToMany(() => SchoolOrm, (school) => school.ownerUser)
    schools!: SchoolOrm[];
}
