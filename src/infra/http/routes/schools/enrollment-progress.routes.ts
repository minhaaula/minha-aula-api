import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../utils/async-handler';
import type { SchoolRouteGuards } from './guards';
import type { SchoolContextRequest } from '../../middlewares/resolve-school-context';
import type { AuthenticatedRequest } from '../../middlewares/auth';
import type { ListSchoolStudentLevels } from '../../../../app/use-cases/list-school-student-levels';
import type { CreateSchoolStudentLevel } from '../../../../app/use-cases/create-school-student-level';
import type { ListSchoolCertificateTemplates } from '../../../../app/use-cases/list-school-certificate-templates';
import type { CreateSchoolCertificateTemplate } from '../../../../app/use-cases/create-school-certificate-template';
import type { GetEnrollmentProgressOverview } from '../../../../app/use-cases/get-enrollment-progress-overview';
import type { RecordEnrollmentLevelPromotion } from '../../../../app/use-cases/record-enrollment-level-promotion';
import type { AppendEnrollmentTimelineEvent } from '../../../../app/use-cases/append-enrollment-timeline-event';
import type { IssueEnrollmentPromotionCertificate } from '../../../../app/use-cases/issue-enrollment-promotion-certificate';
import type { ListEnrollmentTimeline } from '../../../../app/use-cases/list-enrollment-timeline';
import { parseEnrollmentTimelineQuery } from '../../../../app/use-cases/list-enrollment-timeline';

export type EnrollmentProgressRoutesDeps = {
    listSchoolStudentLevels: ListSchoolStudentLevels;
    createSchoolStudentLevel: CreateSchoolStudentLevel;
    listSchoolCertificateTemplates: ListSchoolCertificateTemplates;
    createSchoolCertificateTemplate: CreateSchoolCertificateTemplate;
    getEnrollmentProgressOverview: GetEnrollmentProgressOverview;
    recordEnrollmentLevelPromotion: RecordEnrollmentLevelPromotion;
    appendEnrollmentTimelineEvent: AppendEnrollmentTimelineEvent;
    issueEnrollmentPromotionCertificate: IssueEnrollmentPromotionCertificate;
    listEnrollmentTimeline: ListEnrollmentTimeline;
};

export function buildEnrollmentProgressRoutes(deps: EnrollmentProgressRoutesDeps, guards: SchoolRouteGuards) {
    const router = Router();
    const mw = [guards.requireAuth, guards.requireSchoolPersona, guards.resolveSchoolContext] as const;

    router.get('/student-levels', ...mw, asyncHandler(async (req, res) => {
        const schoolId = (req as SchoolContextRequest).schoolId as string;
        const items = await deps.listSchoolStudentLevels.exec({ schoolId });
        res.json({ levels: items });
    }));

    router.post('/student-levels', ...mw, asyncHandler(async (req, res) => {
        const schoolId = (req as SchoolContextRequest).schoolId as string;
        const bodySchema = z.object({
            label: z.string().trim().min(1),
            sortOrder: z.coerce.number().int().nonnegative(),
            templateCode: z.union([z.string().trim(), z.null()]).optional()
        });
        const body = bodySchema.parse(req.body);
        const created = await deps.createSchoolStudentLevel.exec({
            schoolId,
            label: body.label,
            sortOrder: body.sortOrder,
            templateCode: body.templateCode
        });
        res.status(201).json(created);
    }));

    router.get('/certificate-templates', ...mw, asyncHandler(async (req, res) => {
        const schoolId = (req as SchoolContextRequest).schoolId as string;
        const items = await deps.listSchoolCertificateTemplates.exec({ schoolId });
        res.json({ templates: items });
    }));

    router.post('/certificate-templates', ...mw, asyncHandler(async (req, res) => {
        const schoolId = (req as SchoolContextRequest).schoolId as string;
        const bodySchema = z.object({
            name: z.string().trim().min(1),
            logicalTemplateId: z.string().trim().min(1).max(64),
            layoutConfig: z.record(z.unknown()).optional().nullable()
        });
        const body = bodySchema.parse(req.body);
        const created = await deps.createSchoolCertificateTemplate.exec({
            schoolId,
            name: body.name,
            logicalTemplateId: body.logicalTemplateId,
            layoutConfig: body.layoutConfig ?? null
        });
        res.status(201).json(created);
    }));

    router.get('/enrollments/:enrollmentId/timeline', ...mw, asyncHandler(async (req, res) => {
        const params = z.object({ enrollmentId: z.string().uuid() }).parse(req.params);
        const schoolId = (req as SchoolContextRequest).schoolId as string;
        const pagination = parseEnrollmentTimelineQuery(req.query);
        const result = await deps.listEnrollmentTimeline.execForSchool({
            schoolId,
            enrollmentId: params.enrollmentId,
            ...pagination
        });
        if (!result) {
            return res.status(404).json({ error: 'Matrícula não encontrada nesta escola', code: 'NOT_FOUND' });
        }
        res.json(result);
    }));

    router.get('/enrollments/:enrollmentId/progress', ...mw, asyncHandler(async (req, res) => {
        const params = z.object({ enrollmentId: z.string().uuid() }).parse(req.params);
        const schoolId = (req as SchoolContextRequest).schoolId as string;
        const query = z.object({ timelineLimit: z.coerce.number().int().positive().max(200).optional() }).parse(req.query);
        const overview = await deps.getEnrollmentProgressOverview.exec({
            schoolId,
            enrollmentId: params.enrollmentId,
            timelineLimit: query.timelineLimit
        });
        if (!overview) {
            return res.status(404).json({ error: 'Matrícula não encontrada nesta escola', code: 'NOT_FOUND' });
        }
        res.json(overview);
    }));

    router.post('/enrollments/:enrollmentId/promotions', ...mw, asyncHandler(async (req, res) => {
        const params = z.object({ enrollmentId: z.string().uuid() }).parse(req.params);
        const bodySchema = z.object({
            toLevelId: z.string().uuid(),
            fromLevelId: z.string().uuid().optional().nullable(),
            notes: z.string().max(4096).optional().nullable()
        });
        const body = bodySchema.parse(req.body);
        const schoolId = (req as SchoolContextRequest).schoolId as string;
        const actor = (req as AuthenticatedRequest).user?.sub;
        const result = await deps.recordEnrollmentLevelPromotion.exec({
            schoolId,
            enrollmentId: params.enrollmentId,
            toLevelId: body.toLevelId,
            fromLevelId: body.fromLevelId,
            notes: body.notes,
            actorUserId: typeof actor === 'string' ? actor : null
        });
        res.status(201).json(result);
    }));

    router.post('/enrollments/:enrollmentId/timeline-events', ...mw, asyncHandler(async (req, res) => {
        const params = z.object({ enrollmentId: z.string().uuid() }).parse(req.params);
        const bodySchema = z.object({
            eventType: z.string().trim().min(1).max(64).optional(),
            payload: z.record(z.unknown()).optional().nullable(),
            occurredAt: z.string().datetime().optional().nullable()
        });
        const parsed = bodySchema.parse(req.body ?? {});
        const body = {
            ...parsed,
            eventType: parsed.eventType?.trim() || 'CUSTOM_MILESTONE'
        };
        const schoolId = (req as SchoolContextRequest).schoolId as string;
        const actor = (req as AuthenticatedRequest).user?.sub;
        const result = await deps.appendEnrollmentTimelineEvent.exec({
            schoolId,
            enrollmentId: params.enrollmentId,
            eventType: body.eventType,
            payload: body.payload ?? null,
            occurredAt: body.occurredAt ?? null,
            actorUserId: typeof actor === 'string' ? actor : null
        });
        res.status(201).json(result);
    }));

    router.post(
        '/enrollments/:enrollmentId/promotions/:promotionId/certificates',
        ...mw,
        asyncHandler(async (req, res) => {
            const params = z
                .object({ enrollmentId: z.string().uuid(), promotionId: z.string().uuid() })
                .parse(req.params);
            const bodySchema = z.object({
                certificateTemplateId: z.string().uuid(),
                documentUrl: z.union([z.string().trim().max(2048), z.null()]).optional(),
                metadata: z.record(z.unknown()).optional().nullable()
            });
            const body = bodySchema.parse(req.body);
            const schoolId = (req as SchoolContextRequest).schoolId as string;
            const result = await deps.issueEnrollmentPromotionCertificate.exec({
                schoolId,
                enrollmentId: params.enrollmentId,
                promotionId: params.promotionId,
                certificateTemplateId: body.certificateTemplateId,
                documentUrl: body.documentUrl,
                metadata: body.metadata ?? null
            });
            res.status(201).json(result);
        })
    );

    return router;
}
