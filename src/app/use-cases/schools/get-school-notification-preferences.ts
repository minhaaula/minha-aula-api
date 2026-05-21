import type { SchoolRepository } from '../../../ports/repositories/school.repo';
import { AppError, ErrorCode } from '../../../shared/errors';

export type SchoolNotificationPreferencesView = {
    emailEnabled: boolean;
    whatsappEnabled: boolean;
    pushEnabled: boolean;
};

export class GetSchoolNotificationPreferences {
    constructor(private readonly schools: SchoolRepository) {}

    async exec(input: { schoolId: string }): Promise<SchoolNotificationPreferencesView> {
        const schoolId = input.schoolId.trim();
        if (!schoolId) {
            throw AppError.fromCode(ErrorCode.REQUIRED_FIELD, { field: 'schoolId' });
        }

        const school = await this.schools.findById(schoolId);
        if (!school) {
            throw AppError.fromCode(ErrorCode.SCHOOL_NOT_FOUND, { schoolId });
        }

        return {
            emailEnabled: school.notificationsEmailEnabled,
            whatsappEnabled: school.notificationsWhatsappEnabled,
            pushEnabled: school.notificationsPushEnabled
        };
    }
}

