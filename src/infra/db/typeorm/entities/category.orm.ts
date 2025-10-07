import { Column, CreateDateColumn, Entity, Index, OneToMany, PrimaryColumn } from 'typeorm';
import { SchoolCategoryOrm } from './school-category.orm';
import { SubcategoryOrm } from './subcategory.orm';

@Entity('categories')
@Index('uq_categories_name', ['name'], { unique: true })
export class CategoryOrm {
    @PrimaryColumn('char', { length: 36 }) id!: string;

    @Column('varchar', { length: 191 }) name!: string;

    @CreateDateColumn({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP' }) createdAt!: Date;

    @OneToMany(() => SchoolCategoryOrm, (link) => link.category)
    links!: SchoolCategoryOrm[];

    @OneToMany(() => SubcategoryOrm, (subcategory) => subcategory.category)
    subcategories!: SubcategoryOrm[];
}
