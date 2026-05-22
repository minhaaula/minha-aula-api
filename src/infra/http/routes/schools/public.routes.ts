import { Router, type RequestHandler } from 'express';
import { asyncHandler } from '../../utils/async-handler';
import type { CreateSchool } from '../../../../app/use-cases/schools/create-school';
import type { LoginSchool } from '../../../../app/use-cases/auth/login-school';
import type { ListCategories } from '../../../../app/use-cases/catalog/list-categories';
import type { ListSubscriptionPlans } from '../../../../app/use-cases/catalog/list-subscription-plans';
import type { RequestPhoneOtpChallenge } from '../../../../app/use-cases/auth/request-phone-otp-challenge';
import type { VerifyPhoneOtpChallenge } from '../../../../app/use-cases/auth/verify-phone-otp-challenge';
import type { AuthenticatedRequest } from '../../middlewares/auth';
import { authRateLimiter } from '../../middlewares/rate-limiter';
import { UserPersonaEnum } from '../../../../domain/value-objects/user-persona';
import { createSchoolObjectSchema, createSchoolSchema } from '../../validators/school-schemas';
import { z } from 'zod';
import { mapAddresses } from './transformers';
import { listTuitionExemptionTypes } from '../../../../domain/value-objects/tuition-exemption-type';
import { listGenders } from '../../../../domain/value-objects/gender';

type PublicSchoolRoutesDeps = {
    createSchool: CreateSchool;
    loginSchool?: LoginSchool;
    listCategories?: ListCategories;
    listSubscriptionPlans?: ListSubscriptionPlans;
    requestSchoolSignupPhoneOtp?: RequestPhoneOtpChallenge;
    verifySchoolSignupPhoneOtp?: VerifyPhoneOtpChallenge;
};

export function buildPublicSchoolRoutes(deps: PublicSchoolRoutesDeps, optionalAuth: RequestHandler) {
    const router = Router();

    const signupOtpRequestSchema = z.object({
        phone: createSchoolObjectSchema.shape.ownerWhatsapp
    });

    const signupOtpVerifySchema = z.object({
        challengeId: z.string().uuid(),
        code: z.string().trim().regex(/^\d{4,8}$/)
    });

    if (deps.requestSchoolSignupPhoneOtp) {
        router.post('/verification/request', authRateLimiter, asyncHandler(async (req, res) => {
            const body = signupOtpRequestSchema.parse(req.body ?? {});
            const result = await deps.requestSchoolSignupPhoneOtp!.exec({
                purpose: 'school_signup',
                phone: body.phone
            });
            const status = 'challengeId' in result ? 201 : 200;
            res.status(status).json(result);
        }));
    }

    if (deps.verifySchoolSignupPhoneOtp) {
        router.post('/verification/verify', authRateLimiter, asyncHandler(async (req, res) => {
            const body = signupOtpVerifySchema.parse(req.body ?? {});
            const result = await deps.verifySchoolSignupPhoneOtp!.exec(body);
            res.json(result);
        }));
    }

    if (deps.loginSchool) {
        router.post('/login', authRateLimiter, asyncHandler(async (req, res) => {
            const data = loginSchema.parse(req.body);
            const result = await deps.loginSchool!.exec({
                email: data.email,
                password: data.password
            });
            res.json(result);
        }));
    }

    router.get('/tuition-exemption-types', asyncHandler(async (_req, res) => {
        res.json({ items: listTuitionExemptionTypes() });
    }));

    router.get('/genders', asyncHandler(async (_req, res) => {
        res.json({ items: listGenders() });
    }));

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
            cnpj: data.cnpj ?? null,
            incomeValue: data.incomeValue,
            addresses: mapAddresses(data.addresses),
            ownerUserId,
            ownerName: data.ownerName,
            ownerCpf: data.ownerCpf,
            ownerEmail: data.ownerEmail,
            ownerBirthDate: data.ownerBirthDate ?? null,
            ownerWhatsapp: data.ownerWhatsapp ?? null,
            ownerWhatsappVerificationToken: data.ownerWhatsappVerificationToken,
            ownerPassword: data.ownerPassword
        });

        res.status(201).json(school);
    }));

    return router;
}

function createLoginSchema() {
    return z.object({
        email: createSchoolObjectSchema.shape.email,
        password: createSchoolObjectSchema.shape.ownerPassword
    });
}

const loginSchema = createLoginSchema();
