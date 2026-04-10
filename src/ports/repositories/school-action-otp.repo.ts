import { SchoolActionOtp, type SchoolActionOtpPurpose } from '../../domain/entities/school-action-otp';

export interface SchoolActionOtpRepository {
    save(otp: SchoolActionOtp): Promise<void>;
    findById(id: string): Promise<SchoolActionOtp | null>;
    findLatestBySchoolAndPurpose(schoolId: string, purpose: SchoolActionOtpPurpose): Promise<SchoolActionOtp | null>;
}
