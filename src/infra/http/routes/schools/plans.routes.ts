import { Router } from 'express';
import { asyncHandler } from '../../utils/async-handler';
import type { AssignSchoolPlan } from '../../../../app/use-cases/assign-school-plan';
import type { GetActiveSchoolPlan } from '../../../../app/use-cases/get-active-school-plan';
import { assignSchoolPlanSchema } from '../../validators/school-schemas';
import type { SchoolRouteGuards } from './guards';
import type { SchoolContextRequest } from '../../middlewares/resolve-school-context';

type PlansRoutesDeps = {
    assignSchoolPlan?: AssignSchoolPlan;
    getActiveSchoolPlan?: GetActiveSchoolPlan;
};

export function buildPlansRoutes(deps: PlansRoutesDeps, guards: SchoolRouteGuards) {
    const router = Router();

    if (deps.assignSchoolPlan) {
        router.post('/plan', guards.requireAuth, guards.requireSchoolPersona, guards.resolveSchoolContext, asyncHandler(async (req, res) => {
            const schoolId = (req as SchoolContextRequest).schoolId as string;
            const data = assignSchoolPlanSchema.parse(req.body);
            const result = await deps.assignSchoolPlan!.exec({
                schoolId,
                planId: data.planId,
                notes: data.notes ?? null
            });

            res.status(200).json(result);
        }));
    }

    if (deps.getActiveSchoolPlan) {
        router.get('/plan', guards.requireAuth, guards.requireSchoolPersona, guards.resolveSchoolContext, asyncHandler(async (req, res) => {
            const schoolId = (req as SchoolContextRequest).schoolId as string;
            const plan = await deps.getActiveSchoolPlan!.exec({ schoolId });
            if (!plan) {
                res.status(404).json({ error: 'Active plan not found for school' });
                return;
            }

            res.json(plan);
        }));
    }

    return router;
}
