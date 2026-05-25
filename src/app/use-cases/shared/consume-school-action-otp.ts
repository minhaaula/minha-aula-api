import type { SchoolActionOtpPurpose } from '../../../domain/entities/school-action-otp';
import { SchoolActionOtpRepository } from '../../../ports/repositories/school-action-otp.repo';
import { AppError } from '../../../shared/errors';
import { sanitizeForLogging } from '../../../shared/log-sanitizer';
import { log } from '../../../shared/logger';

export class ConsumeSchoolActionOtp {
    constructor(private readonly otps: SchoolActionOtpRepository) {}

    async exec(input: { schoolId: string; challengeId: string; purpose: SchoolActionOtpPurpose }): Promise<void> {
        const schoolId = input.schoolId.trim();
        const challengeId = input.challengeId.trim();

        if (!schoolId || !challengeId) {
            throw AppError.validation('schoolId e challengeId são obrigatórios');
        }

        const otp = await this.otps.findById(challengeId);
        if (!otp || otp.schoolId !== schoolId || otp.purpose !== input.purpose) {
            throw AppError.validation('OTP inválido para esta operação');
        }

        if (otp.isConsumed()) {
            throw AppError.validation('OTP já utilizado');
        }

        if (otp.isExpired()) {
            throw AppError.validation('OTP expirado');
        }

        if (!otp.isVerified()) {
            throw AppError.validation('OTP ainda não foi validado');
        }

        await this.otps.save(otp.consume(new Date()));

        log.info('[SchoolActionOtp] OTP consumido pela operação sensível', sanitizeForLogging({
            schoolId,
            challengeId,
            purpose: input.purpose
        }));
    }
}
