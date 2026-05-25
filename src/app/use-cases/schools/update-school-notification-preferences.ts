import type { SchoolRepository } from '../../../ports/repositories/school.repo';
import { School } from '../../../domain/entities/school';
import { AppError, ErrorCode } from '../../../shared/errors';
import type { SchoolNotificationPreferencesView } from './get-school-notification-preferences';

export type UpdateSchoolNotificationPreferencesInput = {
    schoolId: string;
    emailEnabled?: boolean;
    whatsappEnabled?: boolean;
    pushEnabled?: boolean;
};

export class UpdateSchoolNotificationPreferences {
    constructor(private readonly schools: SchoolRepository) {}

    async exec(input: UpdateSchoolNotificationPreferencesInput): Promise<SchoolNotificationPreferencesView> {
        const schoolId = input.schoolId.trim();
        if (!schoolId) {
            throw AppError.fromCode(ErrorCode.REQUIRED_FIELD, { field: 'schoolId' });
        }

        const school = await this.schools.findById(schoolId);
        if (!school) {
            throw AppError.fromCode(ErrorCode.SCHOOL_NOT_FOUND, { schoolId });
        }

        const updated = School.create({
            id: school.id,
            name: school.name,
            email: school.email,
            phone: school.phone,
            cnpj: school.cnpj,
            isNonprofitAssociation: school.isNonprofitAssociation,
            addresses: school.addresses,
            createdAt: school.createdAt,
            ownerUserId: school.ownerUserId,
            ownerName: school.ownerName,
            ownerCpf: school.ownerCpf,
            ownerEmail: school.ownerEmail,
            ownerBirthDate: school.ownerBirthDate,
            ownerWhatsapp: school.ownerWhatsapp,
            ownerPasswordHash: school.ownerPasswordHash,
            accountId: school.accountId,
            accountApiKey: school.accountApiKey,
            walletId: school.walletId,
            onboardingUrl: school.onboardingUrl,
            incomeValue: school.incomeValue,
            facebookLink: school.facebookLink,
            instagramLink: school.instagramLink,
            tiktokLink: school.tiktokLink,
            youtubeLink: school.youtubeLink,
            siteLink: school.siteLink,
            onboardingCompletedAt: school.onboardingCompletedAt,
            notificationsEmailEnabled: input.emailEnabled ?? school.notificationsEmailEnabled,
            notificationsWhatsappEnabled: input.whatsappEnabled ?? school.notificationsWhatsappEnabled,
            notificationsPushEnabled: input.pushEnabled ?? school.notificationsPushEnabled
        });

        await this.schools.save(updated);

        return {
            emailEnabled: updated.notificationsEmailEnabled,
            whatsappEnabled: updated.notificationsWhatsappEnabled,
            pushEnabled: updated.notificationsPushEnabled
        };
    }
}

