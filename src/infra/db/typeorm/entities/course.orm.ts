import { Column, CreateDateColumn, DeleteDateColumn, Entity, Index, JoinColumn, ManyToOne, OneToMany, PrimaryColumn } from 'typeorm';
import { SchoolOrm } from './school.orm';
import { CourseClassOrm } from './course-class.orm';
import { CourseCategoryOrm } from './course-category.orm';
import { CourseCategorySubcategoryOrm } from './course-category-subcategory.orm';
import { SchoolFinancialChargeOrm } from './school-financial-charge.orm';

@Entity('courses')
@Index('idx_courses_school', ['schoolId'])
export class CourseOrm {
    @PrimaryColumn('char', { length: 36 }) id!: string;

    @Column('char', { length: 36, name: 'school_id' }) schoolId!: string;

    @Column('varchar', { length: 191 }) name!: string;

    @Column('text', { nullable: true }) description!: string | null;

    @Column('tinyint', { width: 1, name: 'is_active', default: () => '1' }) isActive!: boolean;

    @CreateDateColumn({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP' }) createdAt!: Date;

    @DeleteDateColumn({ name: 'deleted_at', type: 'datetime', nullable: true }) deletedAt!: Date | null;

    @ManyToOne(() => SchoolOrm, (school) => school.courses, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'school_id' })
    school!: SchoolOrm;

    @OneToMany(() => CourseClassOrm, (courseClass) => courseClass.course)
    classes!: CourseClassOrm[];

    @OneToMany(() => CourseCategoryOrm, (category) => category.course, {
        cascade: ['insert', 'update'],
        orphanedRowAction: 'delete'
    })
    categories!: CourseCategoryOrm[];

    @OneToMany(() => CourseCategorySubcategoryOrm, (link) => link.courseCategory)
    categorySubcategories!: CourseCategorySubcategoryOrm[];

    @OneToMany(() => SchoolFinancialChargeOrm, (charge) => charge.course)
    financialCharges!: SchoolFinancialChargeOrm[];
}
