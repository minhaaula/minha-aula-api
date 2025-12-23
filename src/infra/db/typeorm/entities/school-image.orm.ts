import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { SchoolOrm } from './school.orm';

@Entity('school_images')
export class SchoolImageOrm {
    @PrimaryColumn('char', { length: 36 }) id!: string;

    @Column('char', { length: 36, name: 'school_id' }) schoolId!: string;

    @ManyToOne(() => SchoolOrm, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'school_id' })
    school!: SchoolOrm;

    @Column('varchar', { length: 500 }) key!: string;

    @Column('varchar', { length: 100, name: 'content_type' }) contentType!: string;

    @Column('varchar', { length: 255, name: 'original_file_name' }) originalFileName!: string;

    @Column('varchar', { length: 50, default: 'GALLERY' }) category!: string;

    @CreateDateColumn({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP' }) createdAt!: Date;
}

