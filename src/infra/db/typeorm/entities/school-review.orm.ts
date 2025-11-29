import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryColumn, UpdateDateColumn } from 'typeorm';
import { SchoolOrm } from './school.orm';
import { UserOrm } from './user.orm';

@Entity('school_reviews')
@Index('idx_school_reviews_school', ['schoolId'])
@Index('idx_school_reviews_user', ['userId'])
@Index('idx_school_reviews_created_at', ['createdAt'])
export class SchoolReviewOrm {
    @PrimaryColumn('char', { length: 36 }) id!: string;

    @Column('char', { length: 36, name: 'school_id' }) schoolId!: string;

    @Column('char', { length: 36, name: 'user_id' }) userId!: string;

    @Column('tinyint') rating!: number;

    @Column('text', { nullable: true }) description!: string | null;

    @CreateDateColumn({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP' }) createdAt!: Date;

    @UpdateDateColumn({ name: 'updated_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' }) updatedAt!: Date;

    @ManyToOne(() => SchoolOrm, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'school_id' })
    school!: SchoolOrm;

    @ManyToOne(() => UserOrm, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'user_id' })
    user!: UserOrm;
}

