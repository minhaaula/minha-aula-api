import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryColumn, UpdateDateColumn } from 'typeorm';
import { SchoolOrm } from './school.orm';
import { CourseClassOrm } from './course-class.orm';

@Entity('class_sessions')
@Index('idx_class_sessions_class_start', ['courseClassId', 'startsAt'])
@Index('idx_class_sessions_school_start', ['schoolId', 'startsAt'])
export class ClassSessionOrm {
    @PrimaryColumn('char', { length: 36 }) id!: string;

    @Column('char', { length: 36, name: 'school_id' }) schoolId!: string;

    @Column('char', { length: 36, name: 'course_class_id' }) courseClassId!: string;

    @Column('datetime', { name: 'starts_at' }) startsAt!: Date;

    @Column('datetime', { name: 'ends_at' }) endsAt!: Date;

    @Column('varchar', { length: 32 }) status!: string;

    @Column('varchar', { length: 191, nullable: true }) location!: string | null;

    @Column('text', { nullable: true }) notes!: string | null;

    @CreateDateColumn({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP' }) createdAt!: Date;

    @UpdateDateColumn({ name: 'updated_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP' }) updatedAt!: Date;

    @ManyToOne(() => SchoolOrm, (school) => school.classSessions, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'school_id' })
    school!: SchoolOrm;

    @ManyToOne(() => CourseClassOrm, (courseClass) => courseClass.sessions, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'course_class_id' })
    courseClass!: CourseClassOrm;
}
