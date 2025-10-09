import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryColumn, Unique } from 'typeorm';
import { CourseCategoryOrm } from './course-category.orm';
import { SubcategoryOrm } from './subcategory.orm';

@Entity('course_category_subcategories')
@Index('idx_course_category_subcategories_course_category', ['courseCategoryId'])
@Index('idx_course_category_subcategories_subcategory', ['subcategoryId'])
@Unique('uq_course_category_subcategories', ['courseCategoryId', 'subcategoryId'])
export class CourseCategorySubcategoryOrm {
    @PrimaryColumn('char', { length: 36 }) id!: string;

    @Column('char', { length: 36, name: 'course_category_id' }) courseCategoryId!: string;

    @Column('char', { length: 36, name: 'subcategory_id' }) subcategoryId!: string;

    @ManyToOne(() => CourseCategoryOrm, (courseCategory) => courseCategory.subcategories, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'course_category_id' })
    courseCategory!: CourseCategoryOrm;

    @ManyToOne(() => SubcategoryOrm, (subcategory) => subcategory.courseLinks, { eager: true, onDelete: 'CASCADE' })
    @JoinColumn({ name: 'subcategory_id' })
    subcategory!: SubcategoryOrm;
}
