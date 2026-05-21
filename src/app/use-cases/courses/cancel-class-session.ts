import { ClassSessionRepository } from '../../../ports/repositories/class-session.repo';
import { AppError, ErrorCode } from '../../../shared/errors';

export class CancelClassSession {
    constructor(private readonly sessions: ClassSessionRepository) {}

    async exec(input: { schoolId: string; sessionId: string }): Promise<void> {
        const schoolId = input.schoolId.trim();
        if (!schoolId) throw AppError.fromCode(ErrorCode.REQUIRED_FIELD, { field: 'schoolId' });
        const sessionId = input.sessionId.trim();
        if (!sessionId) throw AppError.fromCode(ErrorCode.REQUIRED_FIELD, { field: 'sessionId' });

        const session = await this.sessions.findById(sessionId);
        if (!session || session.schoolId !== schoolId) {
            throw AppError.fromCode(ErrorCode.NOT_FOUND, { message: 'Class session not found', sessionId, schoolId });
        }
        if (session.status === 'CANCELLED') return;
        session.cancel();
        await this.sessions.save(session);
    }
}
