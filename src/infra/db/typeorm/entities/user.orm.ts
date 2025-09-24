import { Column, CreateDateColumn, Entity, Index, PrimaryColumn } from 'typeorm';

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
    @Column('varchar', { length: 255 }) address!: string;
    @Column('varchar', { length: 255, name: 'password_hash' }) passwordHash!: string;
    @CreateDateColumn({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP' }) createdAt!: Date;
}
