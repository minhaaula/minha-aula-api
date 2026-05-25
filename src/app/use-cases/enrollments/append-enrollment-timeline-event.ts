import type { EnrollmentProgressRepository } from '../../../ports/repositories/enrollment-progress.repo';
import { AppError } from '../../../shared/errors';
import { Uuid } from '../../../shared/uuid';

export class AppendEnrollmentTimelineEvent {
    constructor(private readonly progress: EnrollmentProgressRepository) {}

    async exec(input: {
        schoolId: string;
        enrollmentId: string;
        eventType: string;
        payload?: Record<string, unknown> | null;
        occurredAt?: string | Date | null;
        actorUserId?: string | null;
    }) {
        const schoolId = input.schoolId.trim();
        const enrollmentId = input.enrollmentId.trim();
        const eventType = input.eventType.trim().slice(0, 64);
        if (!eventType) throw AppError.validation('eventType é obrigatório');

        const summary = await this.progress.findEnrollmentSummaryInSchool(enrollmentId, schoolId);
        if (!summary) throw AppError.notFound('Matrícula', { enrollmentId });

        const occurredAt =
            input.occurredAt instanceof Date
                ? input.occurredAt
                : input.occurredAt
                  ? new Date(input.occurredAt)
                  : new Date();
        if (Number.isNaN(occurredAt.getTime())) {
            throw AppError.validation('occurredAt inválido');
        }

        const id = Uuid();
        await this.progress.createTimelineEvent({
            id,
            enrollmentId,
            eventType,
            payload: input.payload ?? null,
            occurredAt,
            actorUserId: input.actorUserId?.trim() || null
        });

        return { id, enrollmentId, eventType, occurredAt: occurredAt.toISOString() };
    }
}
