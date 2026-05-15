import { describe, expect, it } from 'vitest';
import { ListEnrollmentTimeline } from '../../src/app/use-cases/list-enrollment-timeline';
import type {
    EnrollmentProgressRepository,
    EnrollmentTimelineContext,
    ListEnrollmentTimelinePageResult
} from '../../src/ports/repositories/enrollment-progress.repo';
import { EnrollmentTimelineEventKind } from '../../src/domain/value-objects/enrollment-timeline-event-kind';

const enrolledAt = new Date('2026-01-10T10:00:00.000Z');
const cancelledAt = new Date('2026-03-15T18:00:00.000Z');

const activeContext: EnrollmentTimelineContext = {
    id: 'enr-1',
    schoolId: 'school-1',
    status: 'ACTIVE',
    enrolledAt,
    updatedAt: new Date('2026-02-01T00:00:00.000Z'),
    ownerUserId: 'owner-1'
};

const cancelledContext: EnrollmentTimelineContext = {
    ...activeContext,
    status: 'CANCELLED',
    updatedAt: cancelledAt
};

function makeRepo(overrides: Partial<EnrollmentProgressRepository> = {}): EnrollmentProgressRepository {
    const defaultPage: ListEnrollmentTimelinePageResult = {
        total: 2,
        items: [
            {
                id: 'enrollment:enr-1',
                kind: EnrollmentTimelineEventKind.ENROLLMENT,
                occurredAt: enrolledAt,
                payload: { status: 'ACTIVE' }
            },
            {
                id: 'promotion:p1',
                kind: EnrollmentTimelineEventKind.LEVEL_PROMOTION,
                occurredAt: new Date('2026-02-01T12:00:00.000Z'),
                payload: { promotionId: 'p1' }
            }
        ]
    };

    return {
        findEnrollmentSummaryInSchool: async () => null,
        findEnrollmentTimelineContextInSchool: async () => activeContext,
        findEnrollmentTimelineContextForOwner: async () => activeContext,
        listAggregatedTimelinePage: async () => defaultPage,
        listLevels: async () => [],
        createLevel: async () => undefined,
        findLevel: async () => null,
        listCertificateTemplates: async () => [],
        createCertificateTemplate: async () => undefined,
        findCertificateTemplate: async () => null,
        listPromotions: async () => [],
        createPromotion: async () => undefined,
        findPromotion: async () => null,
        listTimelineEvents: async () => [],
        createTimelineEvent: async () => undefined,
        countCertificatesByPromotionId: async () => 0,
        createPromotionCertificate: async () => undefined,
        ...overrides
    };
}

describe('ListEnrollmentTimeline', () => {
    it('returns null when enrollment is not in school', async () => {
        const uc = new ListEnrollmentTimeline(
            makeRepo({
                findEnrollmentTimelineContextInSchool: async () => null
            })
        );
        const result = await uc.execForSchool({
            schoolId: 'school-1',
            enrollmentId: 'missing'
        });
        expect(result).toBeNull();
    });

    it('filters school view to enrollment active window when cancelled', async () => {
        let capturedFrom: Date | null | undefined;
        let capturedTo: Date | null | undefined;

        const uc = new ListEnrollmentTimeline(
            makeRepo({
                findEnrollmentTimelineContextInSchool: async () => cancelledContext,
                listAggregatedTimelinePage: async (input) => {
                    capturedFrom = input.occurredFrom;
                    capturedTo = input.occurredTo;
                    return { total: 0, items: [] };
                }
            })
        );

        await uc.execForSchool({ schoolId: 'school-1', enrollmentId: 'enr-1' });

        expect(capturedFrom?.toISOString()).toBe(enrolledAt.toISOString());
        expect(capturedTo?.toISOString()).toBe(cancelledAt.toISOString());
    });

    it('does not cap school view end date while enrollment is active', async () => {
        let capturedTo: Date | null | undefined;

        const uc = new ListEnrollmentTimeline(
            makeRepo({
                listAggregatedTimelinePage: async (input) => {
                    capturedTo = input.occurredTo;
                    return { total: 0, items: [] };
                }
            })
        );

        await uc.execForSchool({ schoolId: 'school-1', enrollmentId: 'enr-1' });
        expect(capturedTo).toBeNull();
    });

    it('student view requests full timeline without date bounds', async () => {
        let capturedFrom: Date | null | undefined;
        let capturedTo: Date | null | undefined;

        const uc = new ListEnrollmentTimeline(
            makeRepo({
                listAggregatedTimelinePage: async (input) => {
                    capturedFrom = input.occurredFrom;
                    capturedTo = input.occurredTo;
                    return { total: 1, items: [] };
                }
            })
        );

        await uc.execForStudent({ ownerUserId: 'owner-1', enrollmentId: 'enr-1' });

        expect(capturedFrom).toBeNull();
        expect(capturedTo).toBeNull();
    });

    it('returns paginated items with ISO timestamps', async () => {
        const uc = new ListEnrollmentTimeline(makeRepo());
        const result = await uc.execForStudent({
            ownerUserId: 'owner-1',
            enrollmentId: 'enr-1',
            limit: 10,
            offset: 0,
            order: 'asc'
        });

        expect(result).not.toBeNull();
        expect(result!.total).toBe(2);
        expect(result!.items).toHaveLength(2);
        expect(result!.items[0].kind).toBe(EnrollmentTimelineEventKind.ENROLLMENT);
        expect(result!.items[0].occurredAt).toBe(enrolledAt.toISOString());
    });

    it('returns null for student when enrollment does not belong to owner', async () => {
        const uc = new ListEnrollmentTimeline(
            makeRepo({
                findEnrollmentTimelineContextForOwner: async () => null
            })
        );
        const result = await uc.execForStudent({
            ownerUserId: 'other',
            enrollmentId: 'enr-1'
        });
        expect(result).toBeNull();
    });
});
