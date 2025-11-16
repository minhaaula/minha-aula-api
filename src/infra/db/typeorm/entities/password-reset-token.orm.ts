import { Column, CreateDateColumn, Entity, PrimaryColumn } from 'typeorm';

@Entity('password_reset_tokens')
export class PasswordResetTokenOrm {
    @PrimaryColumn('char', { length: 36 }) id!: string;

    @Column('varchar', { length: 191 }) email!: string;

    @Column('varchar', { length: 255, unique: true }) token!: string;

    @Column('datetime', { name: 'expires_at' }) expiresAt!: Date;

    @Column('tinyint', { width: 1, default: 0 }) used!: number;

    @CreateDateColumn({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
    createdAt!: Date;
}

