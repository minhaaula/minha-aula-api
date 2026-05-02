import {
    Column,
    CreateDateColumn,
    Entity,
    Index,
    JoinColumn,
    ManyToOne,
    PrimaryColumn,
    UpdateDateColumn
} from 'typeorm';
import { SchoolOrm } from './school.orm';

export type SchoolWithdrawalStatus = 'PROCESSING' | 'COMPLETED' | 'CANCELLED';

@Entity('school_withdrawals')
@Index('idx_school_withdrawals_school', ['schoolId'])
@Index('idx_school_withdrawals_status', ['status'])
@Index('idx_school_withdrawals_created', ['createdAt'])
export class SchoolWithdrawalOrm {
    @PrimaryColumn('char', { length: 36 }) id!: string;

    @Column('char', { length: 36, name: 'school_id' }) schoolId!: string;

    @Column('int', { name: 'amount_cents' }) amountCents!: number;

    @Column('varchar', { length: 191, name: 'bank_name' }) bankName!: string;

    @Column('varchar', { length: 20, name: 'bank_agency' }) bankAgency!: string;

    @Column('varchar', { length: 20, name: 'bank_account' }) bankAccount!: string;

    @Column('varchar', { length: 191, name: 'pix_key', nullable: true }) pixKey!: string | null;

    @Column('enum', {
        enum: ['PROCESSING', 'COMPLETED', 'CANCELLED'],
        default: 'PROCESSING'
    })
    status!: SchoolWithdrawalStatus;

    @Column('datetime', { name: 'processed_at', nullable: true }) processedAt!: Date | null;

    @Column('datetime', { name: 'cancelled_at', nullable: true }) cancelledAt!: Date | null;

    /** Id da transferência no Asaas (POST /accounts/{id}/transfers). Usado pelo webhook /integrations/asaas/transfers. */
    @Column('varchar', { length: 191, name: 'provider_ref', nullable: true })
    providerRef!: string | null;

    /** Motivo da falha retornado pelo Asaas em TRANSFER_FAILED / TRANSFER_BLOCKED. */
    @Column('varchar', { length: 500, name: 'failure_reason', nullable: true })
    failureReason!: string | null;

    @CreateDateColumn({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
    createdAt!: Date;

    @UpdateDateColumn({
        name: 'updated_at',
        type: 'datetime',
        default: () => 'CURRENT_TIMESTAMP',
        onUpdate: 'CURRENT_TIMESTAMP'
    })
    updatedAt!: Date;

    @ManyToOne(() => SchoolOrm, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'school_id' })
    school!: SchoolOrm;
}

