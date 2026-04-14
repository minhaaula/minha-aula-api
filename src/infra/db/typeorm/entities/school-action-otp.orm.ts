import { Column, CreateDateColumn, Entity, Index, PrimaryColumn } from 'typeorm';

@Entity('school_action_otps')
@Index('idx_school_action_otps_school_purpose_created', ['schoolId', 'purpose', 'createdAt'])
export class SchoolActionOtpOrm {
    @PrimaryColumn('char', { length: 36 })
    id!: string;

    @Column('char', { length: 36, name: 'school_id' })
    schoolId!: string;

    @Column('varchar', { length: 32 })
    purpose!: string;

    @Column('varchar', { length: 8 })
    code!: string;

    @Column('varchar', { length: 20 })
    phone!: string;

    @Column('datetime', { name: 'expires_at' })
    expiresAt!: Date;

    @Column('int', { name: 'attempts_used', default: 0 })
    attemptsUsed!: number;

    @Column('int', { name: 'max_attempts', default: 5 })
    maxAttempts!: number;

    @Column('datetime', { name: 'verified_at', nullable: true })
    verifiedAt!: Date | null;

    @Column('datetime', { name: 'consumed_at', nullable: true })
    consumedAt!: Date | null;

    @CreateDateColumn({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
    createdAt!: Date;

    /** SID Twilio Verify (VE…); quando preenchido, o código vem só do Verify (WhatsApp/SMS). */
    @Column('varchar', { name: 'twilio_verification_sid', length: 64, nullable: true })
    twilioVerificationSid!: string | null;
}
