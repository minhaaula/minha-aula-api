import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { SchoolOrm } from './school.orm';
import { UserOrm } from './user.orm';
import { CourseClassOrm } from './course-class.orm';

export type NotificationScope = 'USER' | 'SCHOOL' | 'CLASS';

@Entity('notifications')
@Index('idx_notifications_scope_user', ['scope', 'userId'])
@Index('idx_notifications_scope_school', ['scope', 'schoolId'])
@Index('idx_notifications_scope_class', ['scope', 'courseClassId'])
export class NotificationOrm {
    @PrimaryColumn('char', { length: 36 }) id!: string;

    @Column('enum', { enum: ['USER', 'SCHOOL', 'CLASS'] }) scope!: NotificationScope;

    @Column('char', { length: 36, name: 'school_id', nullable: true }) schoolId!: string | null;

    @Column('char', { length: 36, name: 'user_id', nullable: true }) userId!: string | null;

    @Column('char', { length: 36, name: 'course_class_id', nullable: true }) courseClassId!: string | null;

    @Column('varchar', { length: 191 }) title!: string;

    @Column('text') message!: string;

    @Column('json', { nullable: true }) metadata!: Record<string, unknown> | null;

    @CreateDateColumn({ name: 'sent_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP' }) sentAt!: Date;

    @Column('datetime', { name: 'read_at', nullable: true }) readAt!: Date | null;

    @ManyToOne(() => SchoolOrm, (school) => school.notifications, { nullable: true, onDelete: 'SET NULL' })
    @JoinColumn({ name: 'school_id' })
    school!: SchoolOrm | null;

    @ManyToOne(() => UserOrm, { nullable: true, onDelete: 'SET NULL' })
    @JoinColumn({ name: 'user_id' })
    user!: UserOrm | null;

    @ManyToOne(() => CourseClassOrm, (courseClass) => courseClass.notifications, { nullable: true, onDelete: 'SET NULL' })
    @JoinColumn({ name: 'course_class_id' })
    courseClass!: CourseClassOrm | null;
}
