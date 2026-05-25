import type { SchoolRepository } from '../../../ports/repositories/school.repo';
import type { UpdateSchool } from '../schools/update-school';
import type { UpdateSchoolInput, UpdateSchoolOutput } from '../../types/school.types';
import { AppError, ErrorCode } from '../../../shared/errors';
import { isSchoolOnboardingComplete } from '../../../shared/school-onboarding';

/**
 * Atualiza dados cadastrais da escola pelo admin apenas enquanto o onboarding não estiver concluído.
 */
export class AdminUpdateSchoolRegistration {
    constructor(
        private readonly schools: SchoolRepository,
        private readonly updateSchool: UpdateSchool
    ) {}

    async exec(input: UpdateSchoolInput): Promise<UpdateSchoolOutput> {
        const schoolId = input.schoolId.trim();
        if (!schoolId) {
            throw AppError.fromCode(ErrorCode.REQUIRED_FIELD, { field: 'schoolId' });
        }

        const school = await this.schools.findById(schoolId);
        if (!school) {
            throw AppError.fromCode(ErrorCode.SCHOOL_NOT_FOUND, { schoolId });
        }

        if (isSchoolOnboardingComplete(school)) {
            throw AppError.fromCode(ErrorCode.SCHOOL_ONBOARDING_ALREADY_COMPLETED, { schoolId });
        }

        return this.updateSchool.exec(input);
    }
}
