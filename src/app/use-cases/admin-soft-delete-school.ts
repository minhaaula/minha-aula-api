import { SchoolRepository } from '../../ports/repositories/school.repo';
import { AppError, ErrorCode } from '../../shared/errors';
import { AdminSoftDeleteUser } from './admin-soft-delete-user';

export interface AdminSoftDeleteSchoolInput {
    schoolId: string;
    /** Se true, também exclui logicamente o usuário titular (`owner_user_id`), quando existir. */
    deleteOwnerUser?: boolean;
    ownerDeletionDescription?: string | null;
}

export interface AdminSoftDeleteSchoolOutput {
    success: true;
    schoolId: string;
    alreadyDeleted: boolean;
    ownerUserDeleted: boolean;
}

export class AdminSoftDeleteSchool {
    constructor(
        private readonly schools: SchoolRepository,
        private readonly deleteOwnerUser?: AdminSoftDeleteUser
    ) {}

    async exec(input: AdminSoftDeleteSchoolInput): Promise<AdminSoftDeleteSchoolOutput> {
        const schoolId = input.schoolId?.trim();
        if (!schoolId) {
            throw AppError.fromCode(ErrorCode.VALIDATION_ERROR, { field: 'schoolId' });
        }

        const softDeleteSchool = this.schools.softDeleteByAdmin;
        const isSchoolDeleted = this.schools.isDeleted;
        if (!softDeleteSchool || !isSchoolDeleted) {
            throw AppError.fromCode(ErrorCode.INTERNAL_ERROR);
        }

        if (await isSchoolDeleted.call(this.schools, schoolId)) {
            return {
                success: true,
                schoolId,
                alreadyDeleted: true,
                ownerUserDeleted: false
            };
        }

        const school = await this.schools.findById(schoolId);
        if (!school) {
            throw AppError.fromCode(ErrorCode.SCHOOL_NOT_FOUND, { schoolId });
        }

        const ownerUserId = school.ownerUserId?.trim() || null;

        await softDeleteSchool.call(this.schools, schoolId);

        let ownerUserDeleted = false;
        if (input.deleteOwnerUser && ownerUserId && this.deleteOwnerUser) {
            const ownerResult = await this.deleteOwnerUser.exec({
                userId: ownerUserId,
                description: input.ownerDeletionDescription ?? 'Titular excluído junto com a escola (admin)'
            });
            ownerUserDeleted = true;
            void ownerResult.alreadyDeleted;
        }

        return {
            success: true,
            schoolId,
            alreadyDeleted: false,
            ownerUserDeleted
        };
    }
}
