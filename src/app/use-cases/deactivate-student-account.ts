import { UserRepository } from '../../ports/repositories/user.repo';
import { UserPersonaEnum } from '../../domain/value-objects/user-persona';
import { AppError, ErrorCode } from '../../shared/errors';

export interface DeactivateStudentAccountInput {
    userId: string;
    motivo: string;
    descricao: string;
}

export interface DeactivateStudentAccountOutput {
    success: true;
}

export class DeactivateStudentAccount {
    constructor(private readonly users: UserRepository) {}

    async exec(input: DeactivateStudentAccountInput): Promise<DeactivateStudentAccountOutput> {
        const userId = input.userId?.trim();
        if (!userId) {
            throw AppError.fromCode(ErrorCode.VALIDATION_ERROR, { field: 'userId' });
        }

        const motivo = typeof input.motivo === 'string' ? input.motivo.trim() : '';
        const descricao = typeof input.descricao === 'string' ? input.descricao.trim() : '';
        if (!motivo) {
            throw AppError.validation('O motivo é obrigatório', { field: 'motivo' });
        }

        const user = await this.users.findById(userId);
        if (!user) {
            throw AppError.fromCode(ErrorCode.USER_NOT_FOUND, { userId });
        }

        if (user.persona !== UserPersonaEnum.STUDENT) {
            throw AppError.fromCode(ErrorCode.FORBIDDEN);
        }

        if (!user.active) {
            throw AppError.fromCode(ErrorCode.ACCOUNT_ALREADY_DEACTIVATED);
        }

        if (!this.users.deactivateAccount) {
            throw AppError.fromCode(ErrorCode.INTERNAL_ERROR);
        }

        await this.users.deactivateAccount(userId, motivo, descricao);

        return { success: true };
    }
}
