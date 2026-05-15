import { AppDataSource } from './datasource';
import type {
    EnrollmentProgressRepository,
    EnrollmentProgressCertificateRow,
    EnrollmentProgressCertificateTemplate,
    EnrollmentProgressPromotionRow,
    EnrollmentProgressSchoolLevel,
    EnrollmentProgressTimelineRow,
    EnrollmentTimelineAggregatedItem,
    EnrollmentTimelineContext,
    ListEnrollmentTimelinePageInput,
    ListEnrollmentTimelinePageResult
} from '../../../ports/repositories/enrollment-progress.repo';
import { EnrollmentTimelineEventKind } from '../../../domain/value-objects/enrollment-timeline-event-kind';
import { EnrollmentOrm } from './entities/enrollment.orm';
import { SchoolStudentLevelOrm } from './entities/school-student-level.orm';
import { SchoolCertificateTemplateOrm } from './entities/school-certificate-template.orm';
import { EnrollmentLevelPromotionOrm } from './entities/enrollment-level-promotion.orm';
import { EnrollmentTimelineEventOrm } from './entities/enrollment-timeline-event.orm';
import { EnrollmentPromotionCertificateOrm } from './entities/enrollment-promotion-certificate.orm';
import { equalUuid } from '../../../shared/normalize-uuid';

function toLevelRow(r: SchoolStudentLevelOrm): EnrollmentProgressSchoolLevel {
    return {
        id: r.id,
        schoolId: r.schoolId,
        label: r.label,
        templateCode: r.templateCode,
        sortOrder: r.sortOrder,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt
    };
}

function toTemplateRow(r: SchoolCertificateTemplateOrm): EnrollmentProgressCertificateTemplate {
    return {
        id: r.id,
        schoolId: r.schoolId,
        name: r.name,
        logicalTemplateId: r.logicalTemplateId,
        layoutConfig: r.layoutConfig,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt
    };
}

function toPromotionRow(r: EnrollmentLevelPromotionOrm): EnrollmentProgressPromotionRow {
    return {
        id: r.id,
        enrollmentId: r.enrollmentId,
        fromLevelId: r.fromLevelId,
        toLevelId: r.toLevelId,
        fromLevelLabelSnapshot: r.fromLevelLabelSnapshot,
        toLevelLabelSnapshot: r.toLevelLabelSnapshot,
        fromLevelSortOrderSnapshot: r.fromLevelSortOrderSnapshot,
        toLevelSortOrderSnapshot: r.toLevelSortOrderSnapshot,
        promotedAt: r.promotedAt,
        notes: r.notes,
        createdByUserId: r.createdByUserId,
        createdAt: r.createdAt
    };
}

function toCertificateRow(r: EnrollmentPromotionCertificateOrm): EnrollmentProgressCertificateRow {
    return {
        id: r.id,
        enrollmentId: r.enrollmentId,
        promotionId: r.promotionId,
        certificateTemplateId: r.certificateTemplateId,
        status: r.status === 'GENERATED' ? 'GENERATED' : 'PENDING',
        issuedAt: r.issuedAt,
        documentUrl: r.documentUrl,
        metadata: r.metadata,
        logicalTemplateId: r.certificateTemplate?.logicalTemplateId ?? null,
        templateName: r.certificateTemplate?.name ?? null
    };
}

function toTimelineRow(r: EnrollmentTimelineEventOrm): EnrollmentProgressTimelineRow {
    return {
        id: r.id,
        enrollmentId: r.enrollmentId,
        eventType: r.eventType,
        payload: r.payload,
        occurredAt: r.occurredAt,
        actorUserId: r.actorUserId,
        createdAt: r.createdAt
    };
}

export class EnrollmentProgressRepositoryAdapter implements EnrollmentProgressRepository {
    private readonly enrollments = AppDataSource.getRepository(EnrollmentOrm);
    private readonly levels = AppDataSource.getRepository(SchoolStudentLevelOrm);
    private readonly templates = AppDataSource.getRepository(SchoolCertificateTemplateOrm);
    private readonly promotions = AppDataSource.getRepository(EnrollmentLevelPromotionOrm);
    private readonly timeline = AppDataSource.getRepository(EnrollmentTimelineEventOrm);
    private readonly certificates = AppDataSource.getRepository(EnrollmentPromotionCertificateOrm);

    async findEnrollmentSummaryInSchool(
        enrollmentId: string,
        schoolId: string
    ): Promise<{ id: string; currentSchoolStudentLevelId: string | null } | null> {
        const ctx = await this.findEnrollmentTimelineContextInSchool(enrollmentId, schoolId);
        if (!ctx) return null;
        const row = await this.enrollments.findOne({ where: { id: enrollmentId } });
        return row
            ? { id: row.id, currentSchoolStudentLevelId: row.currentSchoolStudentLevelId }
            : null;
    }

    async findEnrollmentTimelineContextInSchool(
        enrollmentId: string,
        schoolId: string
    ): Promise<EnrollmentTimelineContext | null> {
        const row = await this.enrollments.findOne({
            where: { id: enrollmentId },
            relations: { courseClass: { course: true } }
        });
        return this.toTimelineContext(row, schoolId);
    }

    async findEnrollmentTimelineContextForOwner(
        enrollmentId: string,
        ownerUserId: string
    ): Promise<EnrollmentTimelineContext | null> {
        const row = await this.enrollments.findOne({
            where: { id: enrollmentId, ownerUserId },
            relations: { courseClass: { course: true } }
        });
        return this.toTimelineContext(row, null);
    }

    private toTimelineContext(
        row: EnrollmentOrm | null,
        schoolId: string | null
    ): EnrollmentTimelineContext | null {
        if (!row?.courseClass?.course?.schoolId) return null;
        if (schoolId !== null && !equalUuid(row.courseClass.course.schoolId, schoolId)) return null;
        return {
            id: row.id,
            schoolId: row.courseClass.course.schoolId,
            status: row.status,
            enrolledAt: row.enrolledAt,
            updatedAt: row.updatedAt,
            ownerUserId: row.ownerUserId
        };
    }

    async listAggregatedTimelinePage(input: ListEnrollmentTimelinePageInput): Promise<ListEnrollmentTimelinePageResult> {
        const enrollmentId = input.enrollmentId.trim();
        const enrollment = await this.enrollments.findOne({ where: { id: enrollmentId } });
        if (!enrollment) {
            return { items: [], total: 0 };
        }

        const [promotions, certificates, customEvents] = await Promise.all([
            this.promotions.find({ where: { enrollmentId }, order: { promotedAt: 'ASC' } }),
            this.certificates.find({
                where: { enrollmentId },
                relations: { certificateTemplate: true, promotion: true },
                order: { issuedAt: 'ASC' }
            }),
            this.timeline.find({ where: { enrollmentId }, order: { occurredAt: 'ASC' } })
        ]);

        const aggregated: EnrollmentTimelineAggregatedItem[] = [];

        aggregated.push({
            id: `enrollment:${enrollment.id}`,
            kind: EnrollmentTimelineEventKind.ENROLLMENT,
            occurredAt: enrollment.enrolledAt,
            payload: {
                status: enrollment.status,
                enrolledAt: enrollment.enrolledAt.toISOString()
            }
        });

        for (const p of promotions) {
            aggregated.push({
                id: `promotion:${p.id}`,
                kind: EnrollmentTimelineEventKind.LEVEL_PROMOTION,
                occurredAt: p.promotedAt,
                payload: {
                    promotionId: p.id,
                    fromLevelId: p.fromLevelId,
                    toLevelId: p.toLevelId,
                    fromLevelLabel: p.fromLevelLabelSnapshot,
                    toLevelLabel: p.toLevelLabelSnapshot,
                    fromLevelSortOrder: p.fromLevelSortOrderSnapshot,
                    toLevelSortOrder: p.toLevelSortOrderSnapshot,
                    notes: p.notes
                }
            });
        }

        for (const c of certificates) {
            aggregated.push({
                id: `certificate:${c.id}`,
                kind: EnrollmentTimelineEventKind.CERTIFICATE,
                occurredAt: c.issuedAt,
                payload: {
                    certificateId: c.id,
                    promotionId: c.promotionId,
                    certificateTemplateId: c.certificateTemplateId,
                    templateName: c.certificateTemplate?.name ?? null,
                    logicalTemplateId: c.certificateTemplate?.logicalTemplateId ?? null,
                    documentUrl: c.documentUrl,
                    metadata: c.metadata,
                    status: c.status
                }
            });
        }

        for (const e of customEvents) {
            if (e.eventType === EnrollmentTimelineEventKind.LEVEL_PROMOTION) {
                continue;
            }
            aggregated.push({
                id: e.id,
                kind: EnrollmentTimelineEventKind.CUSTOM_MILESTONE,
                occurredAt: e.occurredAt,
                payload: {
                    eventType: e.eventType,
                    ...(e.payload ?? {}),
                    actorUserId: e.actorUserId
                }
            });
        }

        const filtered = aggregated.filter((item) => this.isWithinVisibilityWindow(item.occurredAt, input));

        filtered.sort((a, b) => {
            const diff = a.occurredAt.getTime() - b.occurredAt.getTime();
            if (diff !== 0) return input.order === 'asc' ? diff : -diff;
            return input.order === 'asc' ? a.id.localeCompare(b.id) : b.id.localeCompare(a.id);
        });

        const total = filtered.length;
        const items = filtered.slice(input.offset, input.offset + input.limit);
        return { items, total };
    }

    private isWithinVisibilityWindow(occurredAt: Date, input: ListEnrollmentTimelinePageInput): boolean {
        if (input.occurredFrom && occurredAt.getTime() < input.occurredFrom.getTime()) {
            return false;
        }
        if (input.occurredTo && occurredAt.getTime() > input.occurredTo.getTime()) {
            return false;
        }
        return true;
    }

    async listLevels(schoolId: string): Promise<EnrollmentProgressSchoolLevel[]> {
        const rows = await this.levels.find({
            where: { schoolId },
            order: { sortOrder: 'ASC' }
        });
        return rows.map(toLevelRow);
    }

    async createLevel(input: {
        id: string;
        schoolId: string;
        label: string;
        templateCode: string | null;
        sortOrder: number;
    }): Promise<void> {
        const row = this.levels.create({
            id: input.id,
            schoolId: input.schoolId,
            label: input.label,
            templateCode: input.templateCode,
            sortOrder: input.sortOrder
        });
        await this.levels.save(row);
    }

    async findLevel(schoolId: string, levelId: string): Promise<EnrollmentProgressSchoolLevel | null> {
        const row = await this.levels.findOne({ where: { id: levelId, schoolId } });
        return row ? toLevelRow(row) : null;
    }

    async updateLevel(input: {
        schoolId: string;
        levelId: string;
        label: string;
        templateCode: string | null;
        sortOrder: number;
    }): Promise<void> {
        await this.levels.update(
            { id: input.levelId, schoolId: input.schoolId },
            {
                label: input.label,
                templateCode: input.templateCode,
                sortOrder: input.sortOrder
            }
        );
    }

    async deleteLevel(schoolId: string, levelId: string): Promise<void> {
        await this.levels.delete({ id: levelId, schoolId });
    }

    async countLevelAssociations(schoolId: string, levelId: string): Promise<number> {
        const currentCount = await this.enrollments
            .createQueryBuilder('e')
            .innerJoin('e.courseClass', 'class')
            .innerJoin('class.course', 'course')
            .where('course.school_id = :schoolId', { schoolId })
            .andWhere('e.current_school_student_level_id = :levelId', { levelId })
            .getCount();

        const promotionCount = await this.promotions
            .createQueryBuilder('p')
            .innerJoin('p.enrollment', 'e')
            .innerJoin('e.courseClass', 'class')
            .innerJoin('class.course', 'course')
            .where('course.school_id = :schoolId', { schoolId })
            .andWhere('(p.from_level_id = :levelId OR p.to_level_id = :levelId)', { levelId })
            .getCount();

        return currentCount + promotionCount;
    }

    async reorderLevels(schoolId: string, items: Array<{ id: string; sortOrder: number }>): Promise<void> {
        await this.levels.manager.transaction(async (manager) => {
            const repo = manager.getRepository(SchoolStudentLevelOrm);
            for (let i = 0; i < items.length; i++) {
                await repo.update(
                    { id: items[i].id, schoolId },
                    { sortOrder: -(i + 1) }
                );
            }
            for (const item of items) {
                await repo.update({ id: item.id, schoolId }, { sortOrder: item.sortOrder });
            }
        });
    }

    async listCertificateTemplates(schoolId: string): Promise<EnrollmentProgressCertificateTemplate[]> {
        const rows = await this.templates.find({ where: { schoolId }, order: { name: 'ASC' } });
        return rows.map(toTemplateRow);
    }

    async createCertificateTemplate(input: {
        id: string;
        schoolId: string;
        name: string;
        logicalTemplateId: string;
        layoutConfig: Record<string, unknown> | null;
    }): Promise<void> {
        const row = this.templates.create({
            id: input.id,
            schoolId: input.schoolId,
            name: input.name,
            logicalTemplateId: input.logicalTemplateId,
            layoutConfig: input.layoutConfig
        });
        await this.templates.save(row);
    }

    async findCertificateTemplate(
        schoolId: string,
        templateId: string
    ): Promise<EnrollmentProgressCertificateTemplate | null> {
        const row = await this.templates.findOne({ where: { id: templateId, schoolId } });
        return row ? toTemplateRow(row) : null;
    }

    async listPromotions(enrollmentId: string, order: 'asc' | 'desc' = 'desc'): Promise<EnrollmentProgressPromotionRow[]> {
        const rows = await this.promotions.find({
            where: { enrollmentId },
            order: { promotedAt: order === 'asc' ? 'ASC' : 'DESC' }
        });
        return rows.map(toPromotionRow);
    }

    async findCertificateByPromotionId(promotionId: string): Promise<EnrollmentProgressCertificateRow | null> {
        const row = await this.certificates.findOne({
            where: { promotionId },
            relations: { certificateTemplate: true }
        });
        return row ? toCertificateRow(row) : null;
    }

    async listCertificatesByEnrollment(enrollmentId: string): Promise<EnrollmentProgressCertificateRow[]> {
        const rows = await this.certificates.find({
            where: { enrollmentId },
            relations: { certificateTemplate: true },
            order: { issuedAt: 'ASC' }
        });
        return rows.map(toCertificateRow);
    }

    async createPromotion(input: {
        id: string;
        enrollmentId: string;
        fromLevelId: string | null;
        toLevelId: string | null;
        fromLevelLabelSnapshot: string | null;
        toLevelLabelSnapshot: string | null;
        fromLevelSortOrderSnapshot: number | null;
        toLevelSortOrderSnapshot: number | null;
        promotedAt: Date;
        notes: string | null;
        createdByUserId: string | null;
    }): Promise<void> {
        const row = this.promotions.create({
            id: input.id,
            enrollmentId: input.enrollmentId,
            fromLevelId: input.fromLevelId,
            toLevelId: input.toLevelId,
            fromLevelLabelSnapshot: input.fromLevelLabelSnapshot,
            toLevelLabelSnapshot: input.toLevelLabelSnapshot,
            fromLevelSortOrderSnapshot: input.fromLevelSortOrderSnapshot,
            toLevelSortOrderSnapshot: input.toLevelSortOrderSnapshot,
            promotedAt: input.promotedAt,
            notes: input.notes,
            createdByUserId: input.createdByUserId
        });
        await this.promotions.save(row);
    }

    async findPromotion(enrollmentId: string, promotionId: string): Promise<EnrollmentProgressPromotionRow | null> {
        const row = await this.promotions.findOne({ where: { id: promotionId, enrollmentId } });
        return row ? toPromotionRow(row) : null;
    }

    async listTimelineEvents(enrollmentId: string, limit: number): Promise<EnrollmentProgressTimelineRow[]> {
        const rows = await this.timeline.find({
            where: { enrollmentId },
            order: { occurredAt: 'DESC' },
            take: Math.min(Math.max(limit, 1), 200)
        });
        return rows.map(toTimelineRow);
    }

    async createTimelineEvent(input: {
        id: string;
        enrollmentId: string;
        eventType: string;
        payload: Record<string, unknown> | null;
        occurredAt: Date;
        actorUserId: string | null;
    }): Promise<void> {
        const row = this.timeline.create({
            id: input.id,
            enrollmentId: input.enrollmentId,
            eventType: input.eventType,
            payload: input.payload,
            occurredAt: input.occurredAt,
            actorUserId: input.actorUserId
        });
        await this.timeline.save(row);
    }

    async countCertificatesByPromotionId(promotionId: string): Promise<number> {
        return this.certificates.count({ where: { promotionId } });
    }

    async createPromotionCertificate(input: {
        id: string;
        enrollmentId: string;
        promotionId: string;
        certificateTemplateId: string;
        status: 'PENDING' | 'GENERATED';
        issuedAt: Date;
        documentUrl: string | null;
        metadata: Record<string, unknown> | null;
    }): Promise<void> {
        const row = this.certificates.create({
            id: input.id,
            enrollmentId: input.enrollmentId,
            promotionId: input.promotionId,
            certificateTemplateId: input.certificateTemplateId,
            status: input.status,
            issuedAt: input.issuedAt,
            documentUrl: input.documentUrl,
            metadata: input.metadata
        });
        await this.certificates.save(row);
    }

    async updatePromotionCertificateDocument(input: {
        certificateId: string;
        documentUrl: string;
        status: 'GENERATED';
    }): Promise<void> {
        await this.certificates.update(
            { id: input.certificateId },
            { documentUrl: input.documentUrl, status: input.status }
        );
    }
}
