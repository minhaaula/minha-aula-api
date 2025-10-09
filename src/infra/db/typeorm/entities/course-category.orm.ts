import { Column, Entity, Index, JoinColumn, ManyToOne, OneToMany, PrimaryColumn, Unique } from 'typeorm';
import { CourseOrm } from './course.orm';
import { CategoryOrm } from './category.orm';
import { CourseCategorySubcategoryOrm } from './course-category-subcategory.orm';

@Entity('course_categories')
@Index('idx_course_categories_course', ['courseId'])
@Index('idx_course_categories_category', ['categoryId'])
@Unique('uq_course_categories_course_category', ['courseId', 'categoryId'])
export class CourseCategoryOrm {
    @PrimaryColumn('char', { length: 36 }) id!: string;

    @Column('char', { length: 36, name: 'course_id' }) courseId!: string;

    @Column('char', { length: 36, name: 'category_id' }) categoryId!: string;

    @ManyToOne(() => CourseOrm, (course) => course.categories, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'course_id' })
    course!: CourseOrm;

    @ManyToOne(() => CategoryOrm, (category) => category.courseLinks, { eager: true, onDelete: 'CASCADE' })
    @JoinColumn({ name: 'category_id' })
    category!: CategoryOrm;

    @OneToMany(() => CourseCategorySubcategoryOrm, (link) => link.courseCategory, {
        cascade: ['insert', 'update'],
        orphanedRowAction: 'delete'
    })
    subcategories!: CourseCategorySubcategoryOrm[];
}
