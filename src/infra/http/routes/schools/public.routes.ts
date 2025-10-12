import { Router, type RequestHandler } from 'express';
import { asyncHandler } from '../../utils/async-handler';
import type { CreateSchool } from '../../../../app/use-cases/create-school';
import type { LoginSchool } from '../../../../app/use-cases/login-school';
import type { ListCategories } from '../../../../app/use-cases/list-categories';
import type { ListSubscriptionPlans } from '../../../../app/use-cases/list-subscription-plans';
import type { AuthenticatedRequest } from '../../middlewares/auth';
import { UserPersonaEnum } from '../../../../domain/value-objects/user-persona';
import { createSchoolSchema } from '../../validators/school-schemas';
import { z } from 'zod';
import { mapAddresses } from './transformers';

type PublicSchoolRoutesDeps = {
    createSchool: CreateSchool;
    loginSchool?: LoginSchool;
    listCategories?: ListCategories;
    listSubscriptionPlans?: ListSubscriptionPlans;
};

export function buildPublicSchoolRoutes(deps: PublicSchoolRoutesDeps, optionalAuth: RequestHandler) {
    const router = Router();

    if (deps.loginSchool) {
        router.post('/login', asyncHandler(async (req, res) => {
            const data = loginSchema.parse(req.body);
            const result = await deps.loginSchool!.exec({
                email: data.email,
                password: data.password
            });
            res.json(result);
        }));
    }

    if (deps.listCategories) {
        router.get('/categories', asyncHandler(async (_req, res) => {
            const result = await deps.listCategories!.exec();
            res.json(result);
        }));
    }

    if (deps.listSubscriptionPlans) {
        router.get('/plans', asyncHandler(async (_req, res) => {
            const result = await deps.listSubscriptionPlans!.exec();
            res.json(result);
        }));
    }

    router.post('/', optionalAuth, asyncHandler(async (req, res) => {
        const data = createSchoolSchema.parse(req.body);
        const authReq = req as AuthenticatedRequest;
        const ownerUserId = authReq.user?.persona === UserPersonaEnum.SCHOOL ? authReq.user.sub : null;

        const school = await deps.createSchool.exec({
            name: data.name,
            email: data.email,
            phone: data.phone,
            cnpj: data.cnpj,
            addresses: mapAddresses(data.addresses),
            ownerUserId,
            ownerName: data.ownerName,
            ownerCpf: data.ownerCpf,
            ownerEmail: data.ownerEmail,
            ownerPassword: data.ownerPassword
        });

        res.status(201).json(school);
    }));

    return router;
}

function createLoginSchema() {
    return z.object({
        email: createSchoolSchema.shape.email,
        password: createSchoolSchema.shape.ownerPassword
    });
}

const loginSchema = createLoginSchema();
