import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryColumn, Unique } from 'typeorm';
import { SchoolCategoryOrm } from './school-category.orm';
import { SubcategoryOrm } from './subcategory.orm';

@Entity('school_category_subcategories')
@Index('idx_school_category_subcategories_school_category', ['schoolCategoryId'])
@Index('idx_school_category_subcategories_subcategory', ['subcategoryId'])
@Unique('uq_school_category_subcategories', ['schoolCategoryId', 'subcategoryId'])
export class SchoolCategorySubcategoryOrm {
    @PrimaryColumn('char', { length: 36 }) id!: string;

    @Column('char', { length: 36, name: 'school_category_id' }) schoolCategoryId!: string;

    @Column('char', { length: 36, name: 'subcategory_id' }) subcategoryId!: string;

    @CreateDateColumn({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP' }) createdAt!: Date;

    @ManyToOne(() => SchoolCategoryOrm, (schoolCategory) => schoolCategory.subcategories, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'school_category_id' })
    schoolCategory!: SchoolCategoryOrm;

    @ManyToOne(() => SubcategoryOrm, (subcategory) => subcategory.links, { eager: true, onDelete: 'CASCADE' })
    @JoinColumn({ name: 'subcategory_id' })
    subcategory!: SubcategoryOrm;
}
