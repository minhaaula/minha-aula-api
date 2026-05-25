import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../utils/async-handler';
import type { ListSchoolNotifications } from '../../../../app/use-cases/schools/list-school-notifications';
import type { SendClassPushNotification } from '../../../../app/use-cases/schools/send-class-push-notification';
import type { GetSchoolNotificationPreferences } from '../../../../app/use-cases/schools/get-school-notification-preferences';
import type { UpdateSchoolNotificationPreferences } from '../../../../app/use-cases/schools/update-school-notification-preferences';
import type { ReadSchoolNotification } from '../../../../app/use-cases/schools/read-school-notification';
import type { ReadAllSchoolNotifications } from '../../../../app/use-cases/schools/read-all-school-notifications';
import type { SchoolRouteGuards } from './guards';
import type { SchoolContextRequest } from '../../middlewares/resolve-school-context';

type NotificationsRoutesDeps = {
    listSchoolNotifications?: ListSchoolNotifications;
    sendClassPushNotification?: SendClassPushNotification;
    getSchoolNotificationPreferences: GetSchoolNotificationPreferences;
    updateSchoolNotificationPreferences: UpdateSchoolNotificationPreferences;
    readSchoolNotification?: ReadSchoolNotification;
    readAllSchoolNotifications?: ReadAllSchoolNotifications;
};

export function buildNotificationsRoutes(deps: NotificationsRoutesDeps, guards: SchoolRouteGuards) {
    const router = Router();

    const protectedMiddleware = [
        guards.requireAuth,
        guards.requireSchoolPersona,
        guards.resolveSchoolContext
    ] as const;

    const querySchema = z.object({
        limit: z.coerce.number().int().positive().max(100).optional(),
        offset: z.coerce.number().int().min(0).optional()
    });

    if (deps.listSchoolNotifications) {
        router.get('/', ...protectedMiddleware, asyncHandler(async (req, res) => {
            const schoolId = (req as SchoolContextRequest).schoolId as string;

            const query = querySchema.parse({
                limit: req.query.limit,
                offset: req.query.offset
            });

            const result = await deps.listSchoolNotifications!.exec({
                schoolId,
                limit: query.limit,
                offset: query.offset
            });

            res.json(result);
        }));
    }

    const updatePrefsSchema = z.object({
        emailEnabled: z.boolean().optional(),
        whatsappEnabled: z.boolean().optional(),
        pushEnabled: z.boolean().optional()
    }).strict();

    router.get('/preferences', ...protectedMiddleware, asyncHandler(async (req, res) => {
        const schoolId = (req as SchoolContextRequest).schoolId as string;
        const result = await deps.getSchoolNotificationPreferences.exec({ schoolId });
        res.json(result);
    }));

    router.put('/preferences', ...protectedMiddleware, asyncHandler(async (req, res) => {
        const schoolId = (req as SchoolContextRequest).schoolId as string;
        const body = updatePrefsSchema.parse(req.body ?? {});
        const result = await deps.updateSchoolNotificationPreferences.exec({
            schoolId,
            emailEnabled: body.emailEnabled,
            whatsappEnabled: body.whatsappEnabled,
            pushEnabled: body.pushEnabled
        });
        res.json(result);
    }));

    if (deps.readAllSchoolNotifications) {
        router.put('/read-all', ...protectedMiddleware, asyncHandler(async (req, res) => {
            const schoolId = (req as SchoolContextRequest).schoolId as string;
            const result = await deps.readAllSchoolNotifications!.exec({ schoolId });
            res.json(result);
        }));
    }

    if (deps.sendClassPushNotification) {
        router.post('/classes/:classId/push', ...protectedMiddleware, asyncHandler(async (req, res) => {
            const schoolId = (req as SchoolContextRequest).schoolId as string;
            const paramsSchema = z.object({ classId: z.string().uuid() });
            const { classId } = paramsSchema.parse(req.params);

            const bodySchema = z.object({
                title: z.string().min(1).max(191),
                message: z.string().min(1).max(2000)
            });
            const body = bodySchema.parse(req.body ?? {});

            const result = await deps.sendClassPushNotification!.exec({
                schoolId,
                classId,
                title: body.title,
                message: body.message,
                metadata: null
            });

            res.status(201).json(result);
        }));
    }

    if (deps.readSchoolNotification) {
        router.put('/:notificationId/read', ...protectedMiddleware, asyncHandler(async (req, res) => {
            const schoolId = (req as SchoolContextRequest).schoolId as string;
            const paramsSchema = z.object({ notificationId: z.string().uuid() });
            const { notificationId } = paramsSchema.parse(req.params);

            const result = await deps.readSchoolNotification!.exec({ schoolId, notificationId });
            res.json(result);
        }));
    }

    return router;
}

