import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, OneToMany, PrimaryColumn } from 'typeorm';
import { CourseOrm } from './course.orm';
import { EnrollmentOrm } from './enrollment.orm';
import { NotificationOrm } from './notification.orm';
import { EnrollmentRequestOrm } from './enrollment-request.orm';
import { ClassSessionOrm } from './class-session.orm';

@Entity('course_classes')
@Index('idx_course_classes_course', ['courseId'])
@Index('uq_course_classes_course_label', ['courseId', 'label', 'isActive'], { unique: true })
export class CourseClassOrm {
    @PrimaryColumn('char', { length: 36 }) id!: string;

    @Column('char', { length: 36, name: 'course_id' }) courseId!: string;

    @Column('varchar', { length: 191 }) label!: string;

    @Column('json') schedule!: Array<{ day: string; start: string; end: string }>;

    @Column('int', { nullable: true }) capacity!: number | null;

    @Column('tinyint', { width: 1, name: 'is_active', default: () => '1' }) isActive!: boolean;

    @CreateDateColumn({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP' }) createdAt!: Date;

    @ManyToOne(() => CourseOrm, (course) => course.classes, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'course_id' })
    course!: CourseOrm;

    @OneToMany(() => EnrollmentOrm, (enrollment) => enrollment.courseClass)
    enrollments!: EnrollmentOrm[];

    @OneToMany(() => NotificationOrm, (notification) => notification.courseClass)
    notifications!: NotificationOrm[];

    @OneToMany(() => EnrollmentRequestOrm, (request) => request.courseClass)
    enrollmentRequests!: EnrollmentRequestOrm[];

    @OneToMany(() => ClassSessionOrm, (session) => session.courseClass)
    sessions!: ClassSessionOrm[];
}
