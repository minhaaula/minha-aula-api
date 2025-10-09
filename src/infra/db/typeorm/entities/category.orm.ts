import { Column, Entity, OneToMany, PrimaryColumn, Unique } from 'typeorm';
import { SubcategoryOrm } from './subcategory.orm';
import { CourseCategoryOrm } from './course-category.orm';

@Entity('categories')
@Unique('uq_categories_name', ['name'])
export class CategoryOrm {
    @PrimaryColumn('char', { length: 36 }) id!: string;

    @Column('varchar', { length: 191 }) name!: string;

    @OneToMany(() => SubcategoryOrm, (subcategory) => subcategory.category)
    subcategories!: SubcategoryOrm[];

    @OneToMany(() => CourseCategoryOrm, (link) => link.category)
    courseLinks!: CourseCategoryOrm[];
}
