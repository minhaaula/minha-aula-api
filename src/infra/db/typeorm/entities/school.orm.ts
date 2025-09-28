import { Column, CreateDateColumn, Entity, OneToMany, PrimaryColumn } from 'typeorm';
import { CourseOrm } from './course.orm';
import { NotificationOrm } from './notification.orm';
import { EnrollmentRequestOrm } from './enrollment-request.orm';

@Entity('schools')
export class SchoolOrm {
    @PrimaryColumn('char', { length: 36 }) id!: string;

    @Column('varchar', { length: 191 }) name!: string;

    @CreateDateColumn({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP' }) createdAt!: Date;

    @OneToMany(() => CourseOrm, (course) => course.school)
    courses!: CourseOrm[];

    @OneToMany(() => NotificationOrm, (notification) => notification.school)
    notifications!: NotificationOrm[];

    @OneToMany(() => EnrollmentRequestOrm, (request) => request.school)
    enrollmentRequests!: EnrollmentRequestOrm[];
}
