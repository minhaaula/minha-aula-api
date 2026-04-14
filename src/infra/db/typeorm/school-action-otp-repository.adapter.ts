import { AppDataSource } from './datasource';
import { SchoolActionOtpRepository } from '../../../ports/repositories/school-action-otp.repo';
import { SchoolActionOtp, type SchoolActionOtpPurpose } from '../../../domain/entities/school-action-otp';
import { SchoolActionOtpOrm } from './entities/school-action-otp.orm';

export class SchoolActionOtpRepositoryAdapter implements SchoolActionOtpRepository {
    private readonly repo = AppDataSource.getRepository(SchoolActionOtpOrm);

    async save(otp: SchoolActionOtp): Promise<void> {
        const existing = await this.repo.findOne({ where: { id: otp.id } });
        const row = existing ?? new SchoolActionOtpOrm();
        row.id = otp.id;
        row.schoolId = otp.schoolId;
        row.purpose = otp.purpose;
        row.code = otp.code;
        row.phone = otp.phone;
        row.expiresAt = otp.expiresAt;
        row.attemptsUsed = otp.attemptsUsed;
        row.maxAttempts = otp.maxAttempts;
        row.verifiedAt = otp.verifiedAt;
        row.consumedAt = otp.consumedAt;
        row.createdAt = otp.createdAt;
        row.twilioVerificationSid = otp.twilioVerificationSid;
        await this.repo.save(row);
    }

    async findById(id: string): Promise<SchoolActionOtp | null> {
        const normalized = id.trim();
        if (!normalized) return null;
        const row = await this.repo.findOne({ where: { id: normalized } });
        return row ? this.toDomain(row) : null;
    }

    async findLatestBySchoolAndPurpose(schoolId: string, purpose: SchoolActionOtpPurpose): Promise<SchoolActionOtp | null> {
        const normalized = schoolId.trim();
        if (!normalized) return null;
        const row = await this.repo.findOne({
            where: { schoolId: normalized, purpose },
            order: { createdAt: 'DESC' }
        });
        return row ? this.toDomain(row) : null;
    }

    private toDomain(row: SchoolActionOtpOrm): SchoolActionOtp {
        return SchoolActionOtp.create({
            id: row.id,
            schoolId: row.schoolId,
            purpose: row.purpose as SchoolActionOtpPurpose,
            code: row.code,
            phone: row.phone,
            expiresAt: row.expiresAt,
            attemptsUsed: row.attemptsUsed,
            maxAttempts: row.maxAttempts,
            verifiedAt: row.verifiedAt,
            consumedAt: row.consumedAt,
            createdAt: row.createdAt,
            twilioVerificationSid: row.twilioVerificationSid ?? null
        });
    }
}
