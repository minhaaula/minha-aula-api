import { Router } from 'express';
import { asyncHandler } from '../../utils/async-handler';
import type { AssignSchoolPlan } from '../../../../app/use-cases/assign-school-plan';
import type { GetActiveSchoolPlan } from '../../../../app/use-cases/get-active-school-plan';
import type { IssueSchoolPlanInvoice } from '../../../../app/use-cases/issue-school-plan-invoice';
import type { ListSchoolPlanInvoices } from '../../../../app/use-cases/list-school-plan-invoices';
import { assignSchoolPlanSchema, issuePlanInvoiceSchema } from '../../validators/school-schemas';
import type { SchoolRouteGuards } from './guards';
import type { SchoolContextRequest } from '../../middlewares/resolve-school-context';

type PlansRoutesDeps = {
    assignSchoolPlan?: AssignSchoolPlan;
    getActiveSchoolPlan?: GetActiveSchoolPlan;
    issueSchoolPlanInvoice?: IssueSchoolPlanInvoice;
    listSchoolPlanInvoices?: ListSchoolPlanInvoices;
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
                notes: data.notes ?? null,
                couponCode: data.couponCode ?? null
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

    if (deps.issueSchoolPlanInvoice) {
        router.post('/plan/invoices', guards.requireAuth, guards.requireSchoolPersona, guards.resolveSchoolContext, asyncHandler(async (req, res) => {
            const schoolId = (req as SchoolContextRequest).schoolId as string;
            const data = issuePlanInvoiceSchema.parse(req.body ?? {});
            const dueDate = data.dueDate ? new Date(data.dueDate) : undefined;
            const result = await deps.issueSchoolPlanInvoice!.execView({
                schoolId,
                dueDate,
                description: data.description ?? null,
                couponCode: data.couponCode ?? null
            });

            res.status(result.alreadyExists ? 200 : 201).json(result);
        }));
    }

    if (deps.listSchoolPlanInvoices) {
        router.get('/plan/invoices', guards.requireAuth, guards.requireSchoolPersona, guards.resolveSchoolContext, asyncHandler(async (req, res) => {
            const schoolId = (req as SchoolContextRequest).schoolId as string;
            const result = await deps.listSchoolPlanInvoices!.exec({ schoolId });
            res.json(result);
        }));
    }

    return router;
}
