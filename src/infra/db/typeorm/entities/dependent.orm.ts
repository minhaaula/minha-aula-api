import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, OneToMany, PrimaryColumn } from 'typeorm';
import { UserOrm } from './user.orm';
import { EnrollmentOrm } from './enrollment.orm';
import { EnrollmentRequestOrm } from './enrollment-request.orm';

@Entity('dependents')
@Index('idx_dependents_user', ['userId'])
export class DependentOrm {
    @PrimaryColumn('char', { length: 36 }) id!: string;

    @Column('char', { length: 36, name: 'user_id' }) userId!: string;

    @Column('varchar', { length: 191, name: 'full_name' }) fullName!: string;

    @Column('char', { length: 11, nullable: true }) cpf!: string | null;

    @Column('date', { name: 'birth_date', nullable: true }) birthDate!: Date | null;

    @Column('varchar', { length: 64, nullable: true }) relationship!: string | null;

    @CreateDateColumn({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP' }) createdAt!: Date;

    @Column('datetime', { name: 'deleted_at', nullable: true }) deletedAt!: Date | null;

    @ManyToOne(() => UserOrm, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'user_id' })
    user!: UserOrm;

    @OneToMany(() => EnrollmentOrm, (enrollment) => enrollment.dependent)
    enrollments!: EnrollmentOrm[];

    @OneToMany(() => EnrollmentRequestOrm, (request) => request.dependent)
    enrollmentRequests!: EnrollmentRequestOrm[];
}
