import { Column, CreateDateColumn, Entity, OneToMany, PrimaryColumn } from 'typeorm';
import { CourseOrm } from './course.orm';
import { NotificationOrm } from './notification.orm';
import { EnrollmentRequestOrm } from './enrollment-request.orm';
import { SchoolAddressOrm } from './school-address.orm';

@Entity('schools')
export class SchoolOrm {
    @PrimaryColumn('char', { length: 36 }) id!: string;

    @Column('varchar', { length: 191 }) name!: string;

    @Column('varchar', { length: 191 }) email!: string;

    @Column('varchar', { length: 32 }) phone!: string;

    @Column('char', { length: 14 }) cnpj!: string;

    @OneToMany(() => SchoolAddressOrm, (address) => address.school, {
        cascade: ['insert', 'update'],
        orphanedRowAction: 'delete'
    })
    addresses!: SchoolAddressOrm[];

    @CreateDateColumn({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP' }) createdAt!: Date;

    @OneToMany(() => CourseOrm, (course) => course.school)
    courses!: CourseOrm[];

    @OneToMany(() => NotificationOrm, (notification) => notification.school)
    notifications!: NotificationOrm[];

    @OneToMany(() => EnrollmentRequestOrm, (request) => request.school)
    enrollmentRequests!: EnrollmentRequestOrm[];
}
