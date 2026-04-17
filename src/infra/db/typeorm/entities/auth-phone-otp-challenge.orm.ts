import { Column, CreateDateColumn, Entity, Index, PrimaryColumn } from 'typeorm';

@Entity('auth_phone_otp_challenges')
@Index('idx_auth_phone_otp_purpose_phone_created', ['purpose', 'phone', 'createdAt'])
export class AuthPhoneOtpChallengeOrm {
    @PrimaryColumn('char', { length: 36 })
    id!: string;

    @Column('varchar', { length: 32 })
    purpose!: string;

    @Column('varchar', { length: 8 })
    code!: string;

    @Column('varchar', { length: 24 })
    phone!: string;

    @Column('varchar', { length: 255, nullable: true })
    email!: string | null;

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

    @Column('varchar', { name: 'twilio_verification_sid', length: 64, nullable: true })
    twilioVerificationSid!: string | null;
}
