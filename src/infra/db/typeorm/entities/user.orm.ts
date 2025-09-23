import { Column, CreateDateColumn, Entity, Index, PrimaryColumn } from 'typeorm';

@Entity('users')
@Index(['email'], { unique: true })
export class UserOrm {
    @PrimaryColumn('char', { length: 36 }) id!: string;
    @Column('varchar', { length: 191 }) email!: string;
    @Column('varchar', { length: 255, name: 'password_hash' }) passwordHash!: string;
    @CreateDateColumn({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP' }) createdAt!: Date;
}
