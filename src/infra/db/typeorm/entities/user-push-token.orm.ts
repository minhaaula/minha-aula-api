import { Column, CreateDateColumn, Entity, Index, PrimaryColumn, UpdateDateColumn } from 'typeorm';

export type PushPlatformOrm = 'ANDROID' | 'IOS' | 'WEB' | 'UNKNOWN';

@Entity('user_push_tokens')
@Index('idx_user_push_tokens_user', ['userId'])
@Index('idx_user_push_tokens_user_revoked', ['userId', 'revokedAt'])
@Index('uq_user_push_tokens_token', ['token'], { unique: true })
export class UserPushTokenOrm {
    @PrimaryColumn('char', { length: 36 })
    id!: string;

    @Column('char', { length: 36, name: 'user_id' })
    userId!: string;

    @Column('varchar', { length: 512 })
    token!: string;

    @Column('enum', { enum: ['ANDROID', 'IOS', 'WEB', 'UNKNOWN'], default: 'UNKNOWN' })
    platform!: PushPlatformOrm;

    @CreateDateColumn({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
    createdAt!: Date;

    @UpdateDateColumn({
        name: 'last_seen_at',
        type: 'datetime',
        default: () => 'CURRENT_TIMESTAMP',
        onUpdate: 'CURRENT_TIMESTAMP'
    })
    lastSeenAt!: Date;

    @Column('datetime', { name: 'revoked_at', nullable: true })
    revokedAt!: Date | null;
}

