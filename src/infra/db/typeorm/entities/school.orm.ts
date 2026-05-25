import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, OneToMany, OneToOne, PrimaryColumn } from 'typeorm';
import { CourseOrm } from './course.orm';
import { NotificationOrm } from './notification.orm';
import { EnrollmentRequestOrm } from './enrollment-request.orm';
import { SchoolAddressOrm } from './school-address.orm';
import { UserOrm } from './user.orm';
import { ClassSessionOrm } from './class-session.orm';
import { SchoolPlanFinanceOrm } from './school-plan-finance.orm';
import { SchoolFinancialChargeOrm } from './school-financial-charge.orm';
import { SchoolBankAccountOrm } from './school-bank-account.orm';

@Entity('schools')
export class SchoolOrm {
    @PrimaryColumn('char', { length: 36 }) id!: string;

    @Column('varchar', { length: 191 }) name!: string;

    @Column('varchar', { length: 191 }) email!: string;

    @Column('varchar', { length: 32 }) phone!: string;

    @Column('char', { length: 14, nullable: true }) cnpj!: string | null;

    /** Associação sem fins lucrativos — exige CNPJ no cadastro. */
    @Column('tinyint', { name: 'is_nonprofit_association', width: 1, default: () => '0' })
    isNonprofitAssociation!: boolean;

    @Column('char', { length: 36, name: 'owner_user_id', nullable: true }) ownerUserId!: string | null;

    @ManyToOne(() => UserOrm, (user) => user.schools, { nullable: true, onDelete: 'SET NULL' })
    @JoinColumn({ name: 'owner_user_id' })
    ownerUser?: UserOrm | null;

    @Column('varchar', { length: 191, name: 'owner_name', nullable: true })
    ownerName!: string | null;

    @Column('char', { length: 11, name: 'owner_cpf', nullable: true })
    ownerCpf!: string | null;

    @Column('varchar', { length: 191, name: 'owner_email', nullable: true })
    ownerEmail!: string | null;

    @Column('date', { name: 'owner_birth_date', nullable: true })
    ownerBirthDate!: Date | null;

    @Column('varchar', { length: 32, name: 'owner_whatsapp', nullable: true })
    ownerWhatsapp!: string | null;

    @Column('varchar', { length: 255, name: 'owner_password_hash', nullable: true })
    ownerPasswordHash!: string | null;

    @Column('varchar', { length: 191, name: 'account_id', nullable: true })
    accountId!: string | null;

    @Column('varchar', { length: 255, name: 'account_api_key', nullable: true })
    accountApiKey!: string | null;

    @Column('varchar', { length: 191, name: 'wallet_id', nullable: true })
    walletId!: string | null;

    @Column('varchar', { length: 500, name: 'onboarding_url', nullable: true })
    onboardingUrl!: string | null;

    /** Expiração do link de onboarding (documentos) retornado pelo Asaas. */
    @Column('datetime', { name: 'onboarding_url_expires_at', nullable: true })
    onboardingUrlExpiresAt!: Date | null;

    @Column('int', { name: 'income_value', default: 5000 })
    incomeValue!: number;

    @Column('varchar', { length: 500, name: 'facebook_link', nullable: true })
    facebookLink!: string | null;

    @Column('varchar', { length: 500, name: 'instagram_link', nullable: true })
    instagramLink!: string | null;

    @Column('varchar', { length: 500, name: 'tiktok_link', nullable: true })
    tiktokLink!: string | null;

    @Column('varchar', { length: 500, name: 'youtube_link', nullable: true })
    youtubeLink!: string | null;

    @Column('varchar', { length: 500, name: 'site_link', nullable: true })
    siteLink!: string | null;

    @Column('datetime', { name: 'onboarding_completed_at', nullable: true })
    onboardingCompletedAt!: Date | null;

    /**
     * Snapshot do último status cadastral recebido via webhook do Asaas (white-label).
     * Estrutura: { commercialInfo, bankAccountInfo, documentation, general, lastEvent, lastEventAt }.
     * Permite à escola visualizar a etapa atual do KYC sem chamar a API do Asaas a cada request.
     */
    @Column('json', { name: 'account_status_snapshot', nullable: true })
    accountStatusSnapshot!: Record<string, unknown> | null;

    @Column('tinyint', { name: 'notifications_email_enabled', width: 1, default: () => '1' })
    notificationsEmailEnabled!: boolean;

    @Column('tinyint', { name: 'notifications_whatsapp_enabled', width: 1, default: () => '1' })
    notificationsWhatsappEnabled!: boolean;

    @Column('tinyint', { name: 'notifications_push_enabled', width: 1, default: () => '1' })
    notificationsPushEnabled!: boolean;

    @OneToMany(() => SchoolAddressOrm, (address) => address.school, {
        cascade: ['insert', 'update'],
        orphanedRowAction: 'delete'
    })
    addresses!: SchoolAddressOrm[];

    @OneToMany(() => ClassSessionOrm, (session) => session.school)
    classSessions!: ClassSessionOrm[];

    @CreateDateColumn({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP' }) createdAt!: Date;

    @Column('tinyint', { name: 'active', default: 1 }) active!: number;

    @Column('datetime', { name: 'deleted_at', nullable: true }) deletedAt!: Date | null;

    @OneToMany(() => CourseOrm, (course) => course.school)
    courses!: CourseOrm[];

    @OneToMany(() => NotificationOrm, (notification) => notification.school)
    notifications!: NotificationOrm[];

    @OneToMany(() => EnrollmentRequestOrm, (request) => request.school)
    enrollmentRequests!: EnrollmentRequestOrm[];

    @OneToOne(() => SchoolPlanFinanceOrm, (finance) => finance.school, { cascade: ['insert', 'update'] })
    planFinance?: SchoolPlanFinanceOrm | null;

    @OneToMany(() => SchoolFinancialChargeOrm, (charge) => charge.school)
    financialCharges!: SchoolFinancialChargeOrm[];

    @OneToMany(() => SchoolBankAccountOrm, (account) => account.school)
    bankAccounts!: SchoolBankAccountOrm[];
}
