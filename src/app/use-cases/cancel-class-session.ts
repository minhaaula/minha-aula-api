import { ClassSessionRepository } from '../../ports/repositories/class-session.repo';

export class CancelClassSession {
    constructor(private readonly sessions: ClassSessionRepository) {}

    async exec(input: { schoolId: string; sessionId: string }): Promise<void> {
        const schoolId = input.schoolId.trim();
        if (!schoolId) throw new Error('School id is required');
        const sessionId = input.sessionId.trim();
        if (!sessionId) throw new Error('Session id is required');

        const session = await this.sessions.findById(sessionId);
        if (!session || session.schoolId !== schoolId) {
            throw new Error('Class session not found');
        }
        if (session.status === 'CANCELLED') return;
        session.cancel();
        await this.sessions.save(session);
    }
}
