import { Column, CreateDateColumn, Entity, JoinColumn, OneToOne, PrimaryColumn, UpdateDateColumn } from 'typeorm';
import { UserOrm } from './user.orm';

export type AppClientPlatformOrm = 'ANDROID' | 'IOS';

@Entity('user_app_client_state')
export class UserAppClientStateOrm {
    @PrimaryColumn('char', { length: 36, name: 'user_id' })
    userId!: string;

    @OneToOne(() => UserOrm, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'user_id' })
    user!: UserOrm;

    @Column('enum', { enum: ['ANDROID', 'IOS'] })
    platform!: AppClientPlatformOrm;

    @Column('varchar', { length: 32, name: 'app_version' })
    appVersion!: string;

    @Column('varchar', { length: 64, name: 'os_version' })
    osVersion!: string;

    @Column('tinyint', { name: 'notifications_enabled', width: 1, default: () => '0' })
    notificationsEnabled!: boolean;

    @Column('datetime', { name: 'last_seen_at' })
    lastSeenAt!: Date;

    @CreateDateColumn({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
    createdAt!: Date;

    @UpdateDateColumn({ name: 'updated_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
    updatedAt!: Date;
}
