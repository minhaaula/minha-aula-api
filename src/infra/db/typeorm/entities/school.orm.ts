import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, OneToMany, OneToOne, PrimaryColumn } from 'typeorm';
import { CourseOrm } from './course.orm';
import { NotificationOrm } from './notification.orm';
import { EnrollmentRequestOrm } from './enrollment-request.orm';
import { SchoolAddressOrm } from './school-address.orm';
import { UserOrm } from './user.orm';
import { ClassSessionOrm } from './class-session.orm';
import { SchoolPlanFinanceOrm } from './school-plan-finance.orm';

@Entity('schools')
export class SchoolOrm {
    @PrimaryColumn('char', { length: 36 }) id!: string;

    @Column('varchar', { length: 191 }) name!: string;

    @Column('varchar', { length: 191 }) email!: string;

    @Column('varchar', { length: 32 }) phone!: string;

    @Column('char', { length: 14 }) cnpj!: string;

    @Column('char', { length: 36, name: 'owner_user_id', nullable: true }) ownerUserId!: string | null;

    @ManyToOne(() => UserOrm, (user) => user.schools, { nullable: true, onDelete: 'SET NULL' })
    @JoinColumn({ name: 'owner_user_id' })
    ownerUser?: UserOrm | null;

    @Column('varchar', { length: 191, name: 'owner_name', nullable: true })
    ownerName!: string | null;

    @Column('char', { length: 11, name: 'owner_cpf', nullable: true })
    ownerCpf!: string | null;

    @Column('varchar', { length: 191, name: 'owner_email', nullable: true })
    ownerEmail!: string | null;

    @Column('varchar', { length: 255, name: 'owner_password_hash', nullable: true })
    ownerPasswordHash!: string | null;

    @Column('varchar', { length: 191, name: 'account_id', nullable: true })
    accountId!: string | null;

    @Column('int', { name: 'income_value', default: 5000 })
    incomeValue!: number;

    @OneToMany(() => SchoolAddressOrm, (address) => address.school, {
        cascade: ['insert', 'update'],
        orphanedRowAction: 'delete'
    })
    addresses!: SchoolAddressOrm[];

    @OneToMany(() => ClassSessionOrm, (session) => session.school)
    classSessions!: ClassSessionOrm[];

    @CreateDateColumn({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP' }) createdAt!: Date;

    @OneToMany(() => CourseOrm, (course) => course.school)
    courses!: CourseOrm[];

    @OneToMany(() => NotificationOrm, (notification) => notification.school)
    notifications!: NotificationOrm[];

    @OneToMany(() => EnrollmentRequestOrm, (request) => request.school)
    enrollmentRequests!: EnrollmentRequestOrm[];

    @OneToOne(() => SchoolPlanFinanceOrm, (finance) => finance.school, { cascade: ['insert', 'update'] })
    planFinance?: SchoolPlanFinanceOrm | null;
}
