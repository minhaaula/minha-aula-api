import type { School } from '../domain/entities/school';

/** Onboarding concluído (KYC aprovado / `onboarding_completed_at` preenchido). */
export function isSchoolOnboardingComplete(school: School): boolean {
    return school.onboardingCompletedAt !== null;
}
