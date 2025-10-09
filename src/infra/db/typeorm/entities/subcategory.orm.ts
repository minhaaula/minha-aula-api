import { Column, Entity, Index, JoinColumn, ManyToOne, OneToMany, PrimaryColumn, Unique } from 'typeorm';
import { CategoryOrm } from './category.orm';
import { CourseCategorySubcategoryOrm } from './course-category-subcategory.orm';

@Entity('subcategories')
@Index('idx_subcategories_category', ['categoryId'])
@Unique('uq_subcategories_category_name', ['categoryId', 'name'])
export class SubcategoryOrm {
    @PrimaryColumn('char', { length: 36 }) id!: string;

    @Column('char', { length: 36, name: 'category_id' }) categoryId!: string;

    @Column('varchar', { length: 191 }) name!: string;

    @ManyToOne(() => CategoryOrm, (category) => category.subcategories, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'category_id' })
    category!: CategoryOrm;

    @OneToMany(() => CourseCategorySubcategoryOrm, (link) => link.subcategory)
    courseLinks!: CourseCategorySubcategoryOrm[];
}
