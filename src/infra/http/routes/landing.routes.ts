import { Router } from 'express';
import { asyncHandler } from '../utils/async-handler';
import type { ListSubscriptionPlans } from '../../../app/use-cases/catalog/list-subscription-plans';

type LandingRoutesDeps = {
    listSubscriptionPlans?: ListSubscriptionPlans;
};

export function landingRouter(deps: LandingRoutesDeps) {
    const router = Router();

    if (deps.listSubscriptionPlans) {
        router.get('/plans', asyncHandler(async (_req, res) => {
            const result = await deps.listSubscriptionPlans!.exec();
            res.json(result);
        }));
    }

    return router;
}

