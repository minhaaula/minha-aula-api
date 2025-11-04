import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../utils/async-handler';
import type { ListSchoolPayments } from '../../../../app/use-cases/list-school-payments';
import type { SchoolRouteGuards } from './guards';
import type { SchoolContextRequest } from '../../middlewares/resolve-school-context';
import { SchoolFinancialChargeStatus } from '../../../../domain/entities/school-financial-charge';

type PaymentsRoutesDeps = {
    listSchoolPayments: ListSchoolPayments;
};

export function buildPaymentsRoutes(deps: PaymentsRoutesDeps, guards: SchoolRouteGuards) {
    const router = Router();

    const protectedMiddleware = [
        guards.requireAuth,
        guards.requireSchoolPersona,
        guards.resolveSchoolContext
    ] as const;

    const querySchema = z.object({
        month: z.coerce.number().int().min(1).max(12),
        year: z.coerce.number().int().min(2000).max(3000),
        studentName: z.string().trim().min(1).optional(),
        classId: z.string().uuid().optional(),
        status: z.enum(['PENDING_SYNC', 'OPEN', 'PAID', 'OVERDUE', 'CANCELLED', 'FAILED']).optional()
    });

    router.get('/', ...protectedMiddleware, asyncHandler(async (req, res) => {
        const schoolId = (req as SchoolContextRequest).schoolId as string;

        const query = querySchema.parse({
            month: req.query.month,
            year: req.query.year,
            studentName: typeof req.query.studentName === 'string' ? req.query.studentName : undefined,
            classId: typeof req.query.classId === 'string' ? req.query.classId : undefined,
            status: typeof req.query.status === 'string' ? req.query.status : undefined
        });

        const payments = await deps.listSchoolPayments.exec({
            schoolId,
            month: query.month,
            year: query.year,
            studentName: query.studentName,
            classId: query.classId,
            status: query.status as SchoolFinancialChargeStatus | undefined
        });

        res.json({ payments });
    }));

    return router;
}

