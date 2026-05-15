import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryColumn, UpdateDateColumn } from 'typeorm';
import { EnrollmentOrm } from './enrollment.orm';
import { EnrollmentLevelPromotionOrm } from './enrollment-level-promotion.orm';
import { SchoolCertificateTemplateOrm } from './school-certificate-template.orm';

/** Certificado emitido para uma promoção específica e matrícula (auditoria e reemissão). */
@Entity('enrollment_promotion_certificates')
@Index('idx_enrollment_promotion_certificates_enrollment', ['enrollmentId'])
@Index('uq_enrollment_promotion_certificates_promotion', ['promotionId'], { unique: true })
export class EnrollmentPromotionCertificateOrm {
    @PrimaryColumn('char', { length: 36 }) id!: string;

    @Column('char', { length: 36, name: 'enrollment_id' }) enrollmentId!: string;

    @Column('char', { length: 36, name: 'promotion_id' }) promotionId!: string;

    @Column('char', { length: 36, name: 'certificate_template_id' }) certificateTemplateId!: string;

    /** PENDING = registro criado; PDF ainda não gerado. GENERATED = document_url preenchido. */
    @Column('varchar', { length: 16, default: 'PENDING' }) status!: 'PENDING' | 'GENERATED';

    @Column('datetime', { name: 'issued_at', default: () => 'CURRENT_TIMESTAMP' }) issuedAt!: Date;

    @Column('varchar', { length: 2048, name: 'document_url', nullable: true }) documentUrl!: string | null;

    @Column('json', { name: 'metadata', nullable: true }) metadata!: Record<string, unknown> | null;

    @ManyToOne(() => EnrollmentOrm, (enrollment) => enrollment.promotionCertificates, { onDelete: 'RESTRICT' })
    @JoinColumn({ name: 'enrollment_id' })
    enrollment!: EnrollmentOrm;

    @ManyToOne(() => EnrollmentLevelPromotionOrm, { onDelete: 'RESTRICT' })
    @JoinColumn({ name: 'promotion_id' })
    promotion!: EnrollmentLevelPromotionOrm;

    @ManyToOne(() => SchoolCertificateTemplateOrm, { onDelete: 'RESTRICT' })
    @JoinColumn({ name: 'certificate_template_id' })
    certificateTemplate!: SchoolCertificateTemplateOrm;

    @CreateDateColumn({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP' }) createdAt!: Date;

    @UpdateDateColumn({ name: 'updated_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP' }) updatedAt!: Date;
}
