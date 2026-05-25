import { SchoolRepository } from '../../../ports/repositories/school.repo';
import { UserRepository } from '../../../ports/repositories/user.repo';
import { UserPersonaEnum } from '../../../domain/value-objects/user-persona';
import { AppError, ErrorCode } from '../../../shared/errors';

export interface AdminSoftDeleteUserInput {
    userId: string;
    description?: string | null;
}

export interface AdminSoftDeleteUserOutput {
    success: true;
    userId: string;
    alreadyDeleted: boolean;
}

export class AdminSoftDeleteUser {
    constructor(
        private readonly users: UserRepository,
        private readonly schools: SchoolRepository
    ) {}

    async exec(input: AdminSoftDeleteUserInput): Promise<AdminSoftDeleteUserOutput> {
        const userId = input.userId?.trim();
        if (!userId) {
            throw AppError.fromCode(ErrorCode.VALIDATION_ERROR, { field: 'userId' });
        }

        const softDelete = this.users.softDeleteByAdmin;
        const isDeleted = this.users.isDeletedByAdmin;
        if (!softDelete || !isDeleted) {
            throw AppError.fromCode(ErrorCode.INTERNAL_ERROR);
        }

        if (await isDeleted.call(this.users, userId)) {
            return { success: true, userId, alreadyDeleted: true };
        }

        const user = await this.users.findById(userId);
        if (!user) {
            throw AppError.fromCode(ErrorCode.USER_NOT_FOUND, { userId });
        }

        if (user.persona === UserPersonaEnum.ADMIN) {
            throw AppError.fromCode(ErrorCode.CANNOT_DELETE_ADMIN_USER);
        }

        if (this.schools.findByOwnerUserId) {
            const ownedSchool = await this.schools.findByOwnerUserId(userId);
            if (ownedSchool) {
                throw AppError.fromCode(ErrorCode.CANNOT_DELETE_USER_WITH_ACTIVE_SCHOOL, {
                    schoolId: ownedSchool.id
                });
            }
        }

        await softDelete.call(this.users, userId, input.description ?? null);

        return { success: true, userId, alreadyDeleted: false };
    }
}
