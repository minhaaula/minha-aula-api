import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, OneToMany, PrimaryColumn, Unique } from 'typeorm';
import { SchoolCategorySubcategoryOrm } from './school-subcategory.orm';
import { CategoryOrm } from './category.orm';

@Entity('subcategories')
@Index('idx_subcategories_category', ['categoryId'])
@Unique('uq_subcategories_category_name', ['categoryId', 'name'])
export class SubcategoryOrm {
    @PrimaryColumn('char', { length: 36 }) id!: string;

    @Column('varchar', { length: 191 }) name!: string;

    @Column('char', { length: 36, name: 'category_id' }) categoryId!: string;

    @CreateDateColumn({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP' }) createdAt!: Date;

    @ManyToOne(() => CategoryOrm, (category) => category.subcategories, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'category_id' })
    category!: CategoryOrm;

    @OneToMany(() => SchoolCategorySubcategoryOrm, (link) => link.subcategory)
    links!: SchoolCategorySubcategoryOrm[];
}
