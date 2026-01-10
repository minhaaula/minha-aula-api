import { Router } from 'express';
import { asyncHandler } from '../../utils/async-handler';
import type { GetSchoolPendingDocuments } from '../../../../app/use-cases/get-school-pending-documents';
import type { SchoolRouteGuards } from './guards';
import type { SchoolContextRequest } from '../../middlewares/resolve-school-context';

type KycRoutesDeps = {
    getSchoolPendingDocuments: GetSchoolPendingDocuments;
};

export function buildKycRoutes(deps: KycRoutesDeps, guards: SchoolRouteGuards) {
    const router = Router();
    const { requireAuth, requireSchoolPersona, resolveSchoolContext } = guards;
    const protectedMiddleware = [requireAuth, requireSchoolPersona, resolveSchoolContext] as const;

    router.get('/documents', ...protectedMiddleware, asyncHandler(async (req, res) => {
        const schoolId = (req as SchoolContextRequest).schoolId as string;
        
        const result = await deps.getSchoolPendingDocuments.exec({ schoolId });
        
        res.json({
            documents: result.documents,
            onboardingUrl: result.onboardingUrl
        });
    }));

    return router;
}

