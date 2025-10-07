import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, OneToMany, PrimaryColumn, Unique } from 'typeorm';
import { SchoolOrm } from './school.orm';
import { CategoryOrm } from './category.orm';
import { SchoolCategorySubcategoryOrm } from './school-subcategory.orm';

@Entity('school_categories')
@Index('idx_school_categories_school', ['schoolId'])
@Index('idx_school_categories_category', ['categoryId'])
@Unique('uq_school_categories_school_category', ['schoolId', 'categoryId'])
export class SchoolCategoryOrm {
    @PrimaryColumn('char', { length: 36 }) id!: string;

    @Column('char', { length: 36, name: 'school_id' }) schoolId!: string;

    @Column('char', { length: 36, name: 'category_id' }) categoryId!: string;

    @CreateDateColumn({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP' }) createdAt!: Date;

    @ManyToOne(() => SchoolOrm, (school) => school.categories, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'school_id' })
    school!: SchoolOrm;

    @ManyToOne(() => CategoryOrm, (category) => category.links, { eager: true, onDelete: 'CASCADE' })
    @JoinColumn({ name: 'category_id' })
    category!: CategoryOrm;

    @OneToMany(() => SchoolCategorySubcategoryOrm, (link) => link.schoolCategory, {
        cascade: ['insert', 'update'],
        orphanedRowAction: 'delete'
    })
    subcategories!: SchoolCategorySubcategoryOrm[];
}
