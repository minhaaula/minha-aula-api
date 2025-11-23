import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryColumn, UpdateDateColumn } from 'typeorm';
import { SchoolOrm } from './school.orm';

@Entity('school_bank_accounts')
@Index('idx_school_bank_accounts_school', ['schoolId'])
@Index('idx_school_bank_accounts_active', ['isActive'])
export class SchoolBankAccountOrm {
    @PrimaryColumn('char', { length: 36 }) id!: string;

    @Column('char', { length: 36, name: 'school_id' }) schoolId!: string;

    @Column('varchar', { length: 191, name: 'bank_name' }) bankName!: string;

    @Column('int', { name: 'bank_code', nullable: true }) bankCode!: number | null;

    @Column('varchar', { length: 20, name: 'bank_agency' }) bankAgency!: string;

    @Column('varchar', { length: 2, name: 'bank_agency_digit', nullable: true }) bankAgencyDigit!: string | null;

    @Column('varchar', { length: 20, name: 'bank_account' }) bankAccount!: string;

    @Column('varchar', { length: 2, name: 'bank_account_digit', nullable: true }) bankAccountDigit!: string | null;

    @Column('enum', { enum: ['CORRENTE', 'POUPANCA'], name: 'bank_account_type' })
    bankAccountType!: 'CORRENTE' | 'POUPANCA';

    @Column('varchar', { length: 14, name: 'bank_account_holder_document' })
    bankAccountHolderDocument!: string;

    @Column('varchar', { length: 191, name: 'pix_key', nullable: true }) pixKey!: string | null;

    @Column('tinyint', { width: 1, name: 'is_active', default: 1 }) isActive!: number;

    @CreateDateColumn({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
    createdAt!: Date;

    @UpdateDateColumn({
        name: 'updated_at',
        type: 'datetime',
        default: () => 'CURRENT_TIMESTAMP',
        onUpdate: 'CURRENT_TIMESTAMP'
    })
    updatedAt!: Date;

    @ManyToOne(() => SchoolOrm, (school) => school.bankAccounts, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'school_id' })
    school!: SchoolOrm;
}

