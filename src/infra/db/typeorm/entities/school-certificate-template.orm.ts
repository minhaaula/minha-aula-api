import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryColumn, UpdateDateColumn } from 'typeorm';
import { SchoolOrm } from './school.orm';

/**
 * Modelos de certificado por escola. O UUID da linha é o identificador do template para geração e evolução futura.
 */
@Entity('school_certificate_templates')
@Index('idx_school_certificate_templates_school', ['schoolId'])
@Index('uq_school_certificate_templates_school_logical_id', ['schoolId', 'logicalTemplateId'], { unique: true })
export class SchoolCertificateTemplateOrm {
    @PrimaryColumn('char', { length: 36 }) id!: string;

    @Column('char', { length: 36, name: 'school_id' }) schoolId!: string;

    @Column('varchar', { length: 191 }) name!: string;

    /**
     * Chave opcional definida pela escola / produto para roteamento de layout (vários modelos lado a lado sem acoplar só ao UUID interno).
     */
    @Column('varchar', { length: 64, name: 'logical_template_id' }) logicalTemplateId!: string;

    /** Payload de layout/variáveis (HTML, placeholders, refs de storage externo, etc.). */
    @Column('json', { name: 'layout_config', nullable: true }) layoutConfig!: Record<string, unknown> | null;

    @ManyToOne(() => SchoolOrm, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'school_id' })
    school!: SchoolOrm;

    @CreateDateColumn({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP' }) createdAt!: Date;

    @UpdateDateColumn({ name: 'updated_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP' }) updatedAt!: Date;
}
