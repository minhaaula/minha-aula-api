import { Router, type RequestHandler } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../utils/async-handler';
import { GetAdminStatus } from '../../../app/use-cases/get-admin-status';
import { ListSchoolsWithPlans } from '../../../app/use-cases/list-schools-with-plans';
import { LoginAdmin } from '../../../app/use-cases/login-admin';
import { GetAdminDashboard } from '../../../app/use-cases/get-admin-dashboard';
import { requirePersona } from '../middlewares/require-persona';
import { authRateLimiter } from '../middlewares/rate-limiter';
import { UserPersonaEnum } from '../../../domain/value-objects/user-persona';
import { buildCouponsRoutes } from './admin/coupons.routes';
import type { ResendSchoolAsaasAccount } from '../../../app/use-cases/resend-school-asaas-account';
import { GetAdminSchoolDetails } from '../../../app/use-cases/get-admin-school-details';
import { GetAdminSchoolPlans } from '../../../app/use-cases/get-admin-school-plans';
import { UpdateSchool } from '../../../app/use-cases/update-school';
import type { ListAdminSubscriptionPlans } from '../../../app/use-cases/list-admin-subscription-plans';
import type { CreateSubscriptionPlan } from '../../../app/use-cases/create-subscription-plan';
import type { UpdateSubscriptionPlan } from '../../../app/use-cases/update-subscription-plan';
import type { ListAdminCategories } from '../../../app/use-cases/list-admin-categories';
import type { CreateCategory } from '../../../app/use-cases/create-category';
import type { UpdateCategory } from '../../../app/use-cases/update-category';

type AdminRouterDeps = {
    getAdminStatus: GetAdminStatus;
    listSchoolsWithPlans: ListSchoolsWithPlans;
    loginAdmin: LoginAdmin;
    getAdminDashboard?: GetAdminDashboard;
    getAdminSchoolDetails: GetAdminSchoolDetails;
    getAdminSchoolPlans: GetAdminSchoolPlans;
    updateSchool: UpdateSchool;
    listAdminSubscriptionPlans?: ListAdminSubscriptionPlans;
    createSubscriptionPlan?: CreateSubscriptionPlan;
    updateSubscriptionPlan?: UpdateSubscriptionPlan;
    listAdminCategories?: ListAdminCategories;
    createCategory?: CreateCategory;
    updateCategory?: UpdateCategory;
    createDiscountCoupon?: import('../../../app/use-cases/create-discount-coupon').CreateDiscountCoupon;
    listDiscountCoupons?: import('../../../app/use-cases/list-discount-coupons').ListDiscountCoupons;
    validateDiscountCoupon?: import('../../../app/use-cases/validate-discount-coupon').ValidateDiscountCoupon;
    resendSchoolAsaasAccount?: ResendSchoolAsaasAccount;
    authMiddleware?: RequestHandler;
};

const loginSchema = z.object({
    email: z.string().email(),
    password: z.string().min(8)
});

function buildAuthGuards(authMiddleware?: RequestHandler) {
    const requireAuth: RequestHandler = authMiddleware ?? ((_req, res) => {
        res.status(401).json({ error: 'Unauthorized' });
    });
    return { requireAuth };
}

export function adminRouter({
    getAdminStatus,
    listSchoolsWithPlans,
    loginAdmin,
    getAdminDashboard,
    getAdminSchoolDetails,
    getAdminSchoolPlans,
    updateSchool,
    listAdminSubscriptionPlans,
    createSubscriptionPlan,
    updateSubscriptionPlan,
    listAdminCategories,
    createCategory,
    updateCategory,
    createDiscountCoupon,
    listDiscountCoupons,
    validateDiscountCoupon,
    resendSchoolAsaasAccount,
    authMiddleware
}: AdminRouterDeps) {
    const router = Router();
    const { requireAuth } = buildAuthGuards(authMiddleware);
    const requireAdminPersona = requirePersona(UserPersonaEnum.ADMIN);

    // Rota pública de login (com rate limit anti brute-force)
    router.post('/login', authRateLimiter, asyncHandler(async (req, res, next) => {
        try {
            const dto = loginSchema.parse(req.body);
            const result = await loginAdmin.exec(dto);
            res.json(result);
        } catch (e) {
            next(e);
        }
    }));

    // Rotas protegidas - requerem autenticação e persona ADMIN
    router.get('/status', requireAuth, requireAdminPersona, asyncHandler(async (_req, res) => {
        const payload = await Promise.resolve(getAdminStatus.exec());
        res.json(payload);
    }));

    router.get('/schools/:schoolId', requireAuth, requireAdminPersona, asyncHandler(async (req, res) => {
        const paramsSchema = z.object({
            schoolId: z.string().uuid()
        });
        const { schoolId } = paramsSchema.parse(req.params);
        const payload = await getAdminSchoolDetails.exec({ schoolId });
        res.json(payload);
    }));

    router.patch('/schools/:schoolId', requireAuth, requireAdminPersona, asyncHandler(async (req, res) => {
        const paramsSchema = z.object({
            schoolId: z.string().uuid()
        });
        const bodySchema = z.object({
            name: z.string().min(1).optional(),
            email: z.string().email().optional(),
            phone: z.string().min(10).max(15).optional(),
            cnpj: z.string().min(14).max(18).optional(),
            incomeValue: z.number().int().positive().optional(),
            ownerName: z.string().min(1).nullable().optional(),
            ownerCpf: z.string().min(11).max(14).nullable().optional(),
            ownerEmail: z.string().email().nullable().optional(),
            ownerUserId: z.string().uuid().nullable().optional(),
            ownerPassword: z.string().min(8).nullable().optional(),
            links: z.object({
                facebook: z.string().url().nullable().optional(),
                instagram: z.string().url().nullable().optional(),
                tiktok: z.string().url().nullable().optional(),
                youtube: z.string().url().nullable().optional(),
                site: z.string().url().nullable().optional()
            }).partial().optional()
        }).strict();

        const { schoolId } = paramsSchema.parse(req.params);
        const body = bodySchema.parse(req.body);

        await updateSchool.exec({
            schoolId,
            ...body
        });

        // Retornar sempre a visão administrativa completa atualizada
        const payload = await getAdminSchoolDetails.exec({ schoolId });
        res.json(payload);
    }));

    router.get('/schools', requireAuth, requireAdminPersona, asyncHandler(async (_req, res) => {
        const schools = await listSchoolsWithPlans.exec();
        res.json({ schools });
    }));

    router.get('/schools/:schoolId/plans', requireAuth, requireAdminPersona, asyncHandler(async (req, res) => {
        const paramsSchema = z.object({
            schoolId: z.string().uuid()
        });
        const { schoolId } = paramsSchema.parse(req.params);
        const payload = await getAdminSchoolPlans.exec({ schoolId });
        res.json(payload);
    }));

    // CRUD de Planos de assinatura
    if (listAdminSubscriptionPlans) {
        router.get('/plans', requireAuth, requireAdminPersona, asyncHandler(async (_req, res) => {
            const payload = await listAdminSubscriptionPlans.exec();
            res.json(payload);
        }));
    }

    if (createSubscriptionPlan) {
        const createPlanSchema = z.object({
            code: z.string().trim().min(1).max(32),
            name: z.string().trim().min(1).max(191),
            description: z.string().trim().max(255).nullable().optional(),
            items: z.array(z.string()).nullable().optional(),
            amountCents: z.number().int().positive(),
            currency: z.string().length(3),
            billingCycle: z.enum(['MONTHLY', 'ANNUAL']).optional(),
            isActive: z.boolean().optional()
        });
        router.post('/plans', requireAuth, requireAdminPersona, asyncHandler(async (req, res) => {
            const body = createPlanSchema.parse(req.body);
            const payload = await createSubscriptionPlan.exec({
                code: body.code,
                name: body.name,
                description: body.description ?? null,
                items: body.items ?? null,
                amountCents: body.amountCents,
                currency: body.currency,
                billingCycle: body.billingCycle,
                isActive: body.isActive
            });
            res.status(201).json(payload);
        }));
    }

    if (updateSubscriptionPlan) {
        const updatePlanSchema = z.object({
            code: z.string().trim().min(1).max(32).optional(),
            name: z.string().trim().min(1).max(191).optional(),
            description: z.string().trim().max(255).nullable().optional(),
            items: z.array(z.string()).nullable().optional(),
            amountCents: z.number().int().positive().optional(),
            currency: z.string().length(3).optional(),
            billingCycle: z.enum(['MONTHLY', 'ANNUAL']).optional(),
            isActive: z.boolean().optional()
        }).strict();
        router.patch('/plans/:planId', requireAuth, requireAdminPersona, asyncHandler(async (req, res) => {
            const paramsSchema = z.object({ planId: z.string().uuid() });
            const { planId } = paramsSchema.parse(req.params);
            const body = updatePlanSchema.parse(req.body);
            const payload = await updateSubscriptionPlan.exec({
                planId,
                ...body
            });
            res.json(payload);
        }));
    }

    // CRUD de Categorias
    if (listAdminCategories) {
        router.get('/categories', requireAuth, requireAdminPersona, asyncHandler(async (_req, res) => {
            const payload = await listAdminCategories.exec();
            res.json(payload);
        }));
    }
    if (createCategory) {
        const createCategorySchema = z.object({
            name: z.string().trim().min(1).max(191),
            icon: z.string().trim().max(191).nullable().optional(),
            description: z.string().trim().max(5000).nullable().optional(),
            subcategories: z.array(z.object({ name: z.string().trim().min(1).max(191) })).optional()
        });
        router.post('/categories', requireAuth, requireAdminPersona, asyncHandler(async (req, res) => {
            const body = createCategorySchema.parse(req.body);
            const payload = await createCategory.exec({
                name: body.name,
                icon: body.icon ?? null,
                description: body.description ?? null,
                subcategories: body.subcategories
            });
            res.status(201).json(payload);
        }));
    }
    if (updateCategory) {
        const updateCategorySchema = z.object({
            name: z.string().trim().min(1).max(191).optional(),
            icon: z.string().trim().max(191).nullable().optional(),
            description: z.string().trim().max(5000).nullable().optional(),
            subcategories: z
                .array(z.object({ id: z.string().uuid().optional(), name: z.string().trim().min(1).max(191) }))
                .optional()
        }).strict();
        router.patch('/categories/:categoryId', requireAuth, requireAdminPersona, asyncHandler(async (req, res) => {
            const paramsSchema = z.object({ categoryId: z.string().uuid() });
            const { categoryId } = paramsSchema.parse(req.params);
            const body = updateCategorySchema.parse(req.body);
            const payload = await updateCategory.exec({
                categoryId,
                ...body
            });
            res.json(payload);
        }));
    }

    if (getAdminDashboard) {
        router.get('/dashboard', requireAuth, requireAdminPersona, asyncHandler(async (_req, res) => {
            const dashboard = await getAdminDashboard.exec();
            res.json(dashboard);
        }));
    }

    // Rotas de cupons de desconto
    router.use('/coupons', buildCouponsRoutes({
        createDiscountCoupon,
        listDiscountCoupons,
        validateDiscountCoupon
    }, authMiddleware));

    // Rota para reenviar solicitação de conta Asaas
    if (resendSchoolAsaasAccount) {
        router.post('/schools/:schoolId/resend-asaas-account', requireAuth, requireAdminPersona, asyncHandler(async (req, res) => {
            const paramsSchema = z.object({
                schoolId: z.string().uuid()
            });
            const { schoolId } = paramsSchema.parse(req.params);
            
            const result = await resendSchoolAsaasAccount.exec({ schoolId });
            
            if (result.success) {
                res.status(200).json(result);
            } else {
                res.status(400).json(result);
            }
        }));
    }

    return router;
}
