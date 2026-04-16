import express from 'express';
import { describe, expect, it, vi } from 'vitest';
import request from 'supertest';

import { buildNotificationsRoutes } from '../../../src/infra/http/routes/schools/notifications.routes';
import { requirePersona } from '../../../src/infra/http/middlewares/require-persona';
import { UserPersonaEnum } from '../../../src/domain/value-objects/user-persona';
import { makeResolveSchoolContextMiddleware } from '../../../src/infra/http/middlewares/resolve-school-context';

type UserCtx = { persona: 'SCHOOL' | 'STUDENT' | 'ADMIN'; sub: string; schoolId?: string | null };

function buildTestApp(params: {
    userCtx: UserCtx;
    getPrefsExec: ReturnType<typeof vi.fn>;
    updatePrefsExec: ReturnType<typeof vi.fn>;
    readSchoolNotificationExec?: ReturnType<typeof vi.fn>;
    readAllSchoolNotificationsExec?: ReturnType<typeof vi.fn>;
}) {
    const app = express();
    app.use(express.json());

    app.use((req, _res, next) => {
        (req as any).user = {
            persona: params.userCtx.persona,
            sub: params.userCtx.sub,
            schoolId: typeof params.userCtx.schoolId === 'string' ? params.userCtx.schoolId : null
        };
        next();
    });

    const router = buildNotificationsRoutes({
        listSchoolNotifications: undefined,
        sendClassPushNotification: undefined,
        getSchoolNotificationPreferences: { exec: params.getPrefsExec } as any,
        updateSchoolNotificationPreferences: { exec: params.updatePrefsExec } as any,
        readSchoolNotification: params.readSchoolNotificationExec
            ? ({ exec: params.readSchoolNotificationExec } as any)
            : undefined,
        readAllSchoolNotifications: params.readAllSchoolNotificationsExec
            ? ({ exec: params.readAllSchoolNotificationsExec } as any)
            : undefined
    }, {
        requireAuth: (_req, _res, next) => next(),
        requireSchoolPersona: requirePersona(UserPersonaEnum.SCHOOL),
        resolveSchoolContext: makeResolveSchoolContextMiddleware(undefined)
    });

    app.use('/schools/notifications', router);

    app.use((err: any, _req: any, res: any, _next: any) => {
        res.status(400).json({ error: err?.message ?? 'Bad Request' });
    });

    return app;
}

describe('schools notifications preferences routes (HTTP)', () => {
    it('GET /schools/notifications/preferences retorna preferências', async () => {
        const getExec = vi.fn(async () => ({ emailEnabled: true, whatsappEnabled: false, pushEnabled: true }));
        const updateExec = vi.fn(async () => ({ emailEnabled: true, whatsappEnabled: true, pushEnabled: true }));

        const app = buildTestApp({
            userCtx: { persona: 'SCHOOL', sub: 'x', schoolId: '550e8400-e29b-41d4-a716-446655440000' },
            getPrefsExec: getExec,
            updatePrefsExec: updateExec
        });

        const res = await request(app).get('/schools/notifications/preferences');
        expect(res.status).toBe(200);
        expect(res.body).toEqual({ emailEnabled: true, whatsappEnabled: false, pushEnabled: true });
        expect(getExec).toHaveBeenCalledTimes(1);
    });

    it('PUT /schools/notifications/preferences valida body strict e chama use-case', async () => {
        const getExec = vi.fn(async () => ({ emailEnabled: true, whatsappEnabled: true, pushEnabled: true }));
        const updateExec = vi.fn(async (input: any) => ({
            emailEnabled: Boolean(input.emailEnabled ?? true),
            whatsappEnabled: Boolean(input.whatsappEnabled ?? true),
            pushEnabled: Boolean(input.pushEnabled ?? true)
        }));

        const app = buildTestApp({
            userCtx: { persona: 'SCHOOL', sub: 'x', schoolId: '550e8400-e29b-41d4-a716-446655440000' },
            getPrefsExec: getExec,
            updatePrefsExec: updateExec
        });

        const ok = await request(app)
            .put('/schools/notifications/preferences')
            .send({ whatsappEnabled: false });
        expect(ok.status).toBe(200);
        expect(updateExec).toHaveBeenCalledTimes(1);
        expect(updateExec.mock.calls[0][0]).toMatchObject({
            schoolId: '550e8400-e29b-41d4-a716-446655440000',
            whatsappEnabled: false
        });

        const bad = await request(app)
            .put('/schools/notifications/preferences')
            .send({ whatsappEnabled: false, unknownField: true });
        expect(bad.status).toBe(400);
    });

    it('PUT /schools/notifications/:notificationId/read marca como lida', async () => {
        const getExec = vi.fn(async () => ({ emailEnabled: true, whatsappEnabled: true, pushEnabled: true }));
        const updateExec = vi.fn(async () => ({ emailEnabled: true, whatsappEnabled: true, pushEnabled: true }));
        const readExec = vi.fn(async () => ({
            id: '550e8400-e29b-41d4-a716-446655440000',
            readAt: '2026-01-01T00:00:00.000Z'
        }));

        const app = buildTestApp({
            userCtx: { persona: 'SCHOOL', sub: 'x', schoolId: '550e8400-e29b-41d4-a716-446655440000' },
            getPrefsExec: getExec,
            updatePrefsExec: updateExec,
            readSchoolNotificationExec: readExec
        });

        const res = await request(app).put('/schools/notifications/550e8400-e29b-41d4-a716-446655440000/read');
        expect(res.status).toBe(200);
        expect(res.body).toEqual({
            id: '550e8400-e29b-41d4-a716-446655440000',
            readAt: '2026-01-01T00:00:00.000Z'
        });
        expect(readExec).toHaveBeenCalledTimes(1);
    });

    it('PUT /schools/notifications/read-all marca todas como lidas', async () => {
        const getExec = vi.fn(async () => ({ emailEnabled: true, whatsappEnabled: true, pushEnabled: true }));
        const updateExec = vi.fn(async () => ({ emailEnabled: true, whatsappEnabled: true, pushEnabled: true }));
        const readAllExec = vi.fn(async () => ({ markedCount: 3 }));

        const app = buildTestApp({
            userCtx: { persona: 'SCHOOL', sub: 'x', schoolId: '550e8400-e29b-41d4-a716-446655440000' },
            getPrefsExec: getExec,
            updatePrefsExec: updateExec,
            readAllSchoolNotificationsExec: readAllExec
        });

        const res = await request(app).put('/schools/notifications/read-all');
        expect(res.status).toBe(200);
        expect(res.body).toEqual({ markedCount: 3 });
        expect(readAllExec).toHaveBeenCalledTimes(1);
        expect(readAllExec.mock.calls[0][0]).toEqual({
            schoolId: '550e8400-e29b-41d4-a716-446655440000'
        });
    });
});

