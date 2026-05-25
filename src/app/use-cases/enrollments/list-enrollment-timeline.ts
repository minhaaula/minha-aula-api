import type {
    EnrollmentProgressRepository,
    EnrollmentTimelineAggregatedItem,
    EnrollmentTimelineContext
} from '../../../ports/repositories/enrollment-progress.repo';
import { EnrollmentTimelineEventKind } from '../../../domain/value-objects/enrollment-timeline-event-kind';
import { AppError } from '../../../shared/errors';

export type ListEnrollmentTimelineOutput = {
    enrollmentId: string;
    items: Array<{
        id: string;
        kind: EnrollmentTimelineEventKind;
        occurredAt: string;
        payload: Record<string, unknown>;
    }>;
    total: number;
    limit: number;
    offset: number;
    order: 'asc' | 'desc';
};

type PaginationInput = {
    enrollmentId: string;
    limit?: number;
    offset?: number;
    order?: 'asc' | 'desc';
};

export class ListEnrollmentTimeline {
    constructor(private readonly progress: EnrollmentProgressRepository) {}

    async execForSchool(input: PaginationInput & { schoolId: string }): Promise<ListEnrollmentTimelineOutput | null> {
        const schoolId = input.schoolId.trim();
        const enrollmentId = input.enrollmentId.trim();
        const context = await this.progress.findEnrollmentTimelineContextInSchool(enrollmentId, schoolId);
        if (!context) return null;

        const { occurredFrom, occurredTo } = this.schoolVisibilityWindow(context);
        return this.listPage(context.id, occurredFrom, occurredTo, input);
    }

    async execForStudent(input: PaginationInput & { ownerUserId: string }): Promise<ListEnrollmentTimelineOutput | null> {
        const ownerUserId = input.ownerUserId.trim();
        const enrollmentId = input.enrollmentId.trim();
        const context = await this.progress.findEnrollmentTimelineContextForOwner(enrollmentId, ownerUserId);
        if (!context) return null;

        return this.listPage(context.id, null, null, input);
    }

    /** Período visível para a escola: da matrícula até o encerramento (desmatrícula/conclusão). */
    schoolVisibilityWindow(context: EnrollmentTimelineContext): {
        occurredFrom: Date;
        occurredTo: Date | null;
    } {
        const occurredFrom = context.enrolledAt;
        const ended =
            context.status === 'CANCELLED' || context.status === 'COMPLETED' ? context.updatedAt : null;
        return { occurredFrom, occurredTo: ended };
    }

    private async listPage(
        enrollmentId: string,
        occurredFrom: Date | null,
        occurredTo: Date | null,
        input: PaginationInput
    ): Promise<ListEnrollmentTimelineOutput> {
        const limit = Math.min(Math.max(input.limit ?? 30, 1), 100);
        const offset = Math.max(input.offset ?? 0, 0);
        const order = input.order === 'desc' ? 'desc' : 'asc';

        const page = await this.progress.listAggregatedTimelinePage({
            enrollmentId,
            occurredFrom,
            occurredTo,
            limit,
            offset,
            order
        });

        return {
            enrollmentId,
            items: page.items.map((item) => this.serializeItem(item)),
            total: page.total,
            limit,
            offset,
            order
        };
    }

    private serializeItem(item: EnrollmentTimelineAggregatedItem): ListEnrollmentTimelineOutput['items'][number] {
        return {
            id: item.id,
            kind: item.kind,
            occurredAt: item.occurredAt.toISOString(),
            payload: item.payload
        };
    }
}

/** Valida paginação comum das rotas HTTP. */
export function parseEnrollmentTimelineQuery(query: unknown): {
    limit: number;
    offset: number;
    order: 'asc' | 'desc';
} {
    const schema = {
        limit: 30,
        offset: 0,
        order: 'asc' as const
    };
    if (!query || typeof query !== 'object') {
        return schema;
    }
    const q = query as Record<string, unknown>;
    const limitRaw = q.limit !== undefined ? Number(q.limit) : schema.limit;
    const offsetRaw = q.offset !== undefined ? Number(q.offset) : schema.offset;
    const orderRaw = typeof q.order === 'string' ? q.order.toLowerCase() : schema.order;

    const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(Math.trunc(limitRaw), 1), 100) : schema.limit;
    const offset = Number.isFinite(offsetRaw) ? Math.max(Math.trunc(offsetRaw), 0) : schema.offset;
    const order = orderRaw === 'desc' ? 'desc' : 'asc';

    if (Number.isNaN(limit) || Number.isNaN(offset)) {
        throw AppError.validation('Parâmetros limit e offset inválidos');
    }

    return { limit, offset, order };
}
