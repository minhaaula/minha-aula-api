import { Router, type RequestHandler } from 'express';
import { z } from 'zod';
import { Queue } from 'bullmq';
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
import type { ListSchoolStudents } from '../../../app/use-cases/list-school-students';
import type { ListAllStudents } from '../../../app/use-cases/list-all-students';
import type { ListAdminStudentCourses } from '../../../app/use-cases/list-admin-student-courses';
import type { GetAdminStudentDetails } from '../../../app/use-cases/get-admin-student-details';
import type { ListAdminSchoolCourses } from '../../../app/use-cases/list-admin-school-courses';
import type { GetAdminSchoolFinancial } from '../../../app/use-cases/get-admin-school-financial';
import type { GetAdminSchoolBilling } from '../../../app/use-cases/get-admin-school-billing';
import type { ListAdminSchoolInvoices } from '../../../app/use-cases/list-admin-school-invoices';
import type { ListAdminPaymentHistory } from '../../../app/use-cases/list-admin-payment-history';
import type { ScheduleChargeDueReminders } from '../../../app/use-cases/schedule-charge-due-reminders';
import type { AdminMarkInvoicePaid } from '../../../app/use-cases/admin-mark-invoice-paid';
import type { AdminMarkChargePaid } from '../../../app/use-cases/admin-mark-charge-paid';

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
    listSchoolStudents?: ListSchoolStudents;
    listAllStudents?: ListAllStudents;
    listAdminStudentCourses?: ListAdminStudentCourses;
    getAdminStudentDetails?: GetAdminStudentDetails;
    listAdminSchoolCourses?: ListAdminSchoolCourses;
    getAdminSchoolFinancial?: GetAdminSchoolFinancial;
    getAdminSchoolBilling?: GetAdminSchoolBilling;
    listAdminSchoolInvoices?: ListAdminSchoolInvoices;
    listAdminPaymentHistory?: ListAdminPaymentHistory;
    adminMarkInvoicePaid?: AdminMarkInvoicePaid;
    adminMarkChargePaid?: AdminMarkChargePaid;
    scheduleChargeDueReminders?: ScheduleChargeDueReminders;
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
    listSchoolStudents,
    listAllStudents,
    listAdminStudentCourses,
    getAdminStudentDetails,
    listAdminSchoolCourses,
    getAdminSchoolFinancial,
    getAdminSchoolBilling,
    listAdminSchoolInvoices,
    listAdminPaymentHistory,
    adminMarkInvoicePaid,
    adminMarkChargePaid,
    scheduleChargeDueReminders,
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

    if (getAdminSchoolFinancial) {
        router.get('/schools/:schoolId/financial', requireAuth, requireAdminPersona, asyncHandler(async (req, res) => {
            const paramsSchema = z.object({
                schoolId: z.string().uuid()
            });
            const { schoolId } = paramsSchema.parse(req.params);
            const payload = await getAdminSchoolFinancial.exec({ schoolId });
            res.json(payload);
        }));
    }

    if (getAdminSchoolBilling) {
        const billingQuerySchema = z.object({
            monthsLimit: z.coerce.number().int().min(1).max(60).optional()
        });
        router.get('/schools/:schoolId/billing', requireAuth, requireAdminPersona, asyncHandler(async (req, res) => {
            const paramsSchema = z.object({
                schoolId: z.string().uuid()
            });
            const { schoolId } = paramsSchema.parse(req.params);
            const query = billingQuerySchema.parse(req.query);
            const payload = await getAdminSchoolBilling.exec({
                schoolId,
                monthsLimit: query.monthsLimit
            });
            res.json(payload);
        }));
    }

    if (listAdminSchoolInvoices) {
        router.get('/schools/:schoolId/invoices', requireAuth, requireAdminPersona, asyncHandler(async (req, res) => {
            const paramsSchema = z.object({
                schoolId: z.string().uuid()
            });
            const { schoolId } = paramsSchema.parse(req.params);
            const payload = await listAdminSchoolInvoices.exec({ schoolId });
            res.json(payload);
        }));
    }

    const schoolsListQuerySchema = z.object({
        name: z.string().trim().min(1).optional(),
        status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
        paymentStatus: z.enum(['EM_DIA', 'ATRASADO']).optional(),
        limit: z.coerce.number().int().positive().max(500).optional(),
        offset: z.coerce.number().int().min(0).optional()
    });
    router.get('/schools', requireAuth, requireAdminPersona, asyncHandler(async (req, res) => {
        const query = schoolsListQuerySchema.parse({
            name: typeof req.query.name === 'string' ? req.query.name : undefined,
            status: typeof req.query.status === 'string' ? req.query.status : undefined,
            paymentStatus: typeof req.query.paymentStatus === 'string' ? req.query.paymentStatus : undefined,
            limit: req.query.limit,
            offset: req.query.offset
        });
        const result = await listSchoolsWithPlans.exec({
            name: query.name,
            status: query.status,
            paymentStatus: query.paymentStatus,
            limit: query.limit,
            offset: query.offset
        });
        res.json(result);
    }));

    router.get('/schools/:schoolId/plans', requireAuth, requireAdminPersona, asyncHandler(async (req, res) => {
        const paramsSchema = z.object({
            schoolId: z.string().uuid()
        });
        const { schoolId } = paramsSchema.parse(req.params);
        const payload = await getAdminSchoolPlans.exec({ schoolId });
        res.json(payload);
    }));

    if (listAdminSchoolCourses) {
        router.get('/schools/:schoolId/courses', requireAuth, requireAdminPersona, asyncHandler(async (req, res) => {
            const paramsSchema = z.object({ schoolId: z.string().uuid() });
            const { schoolId } = paramsSchema.parse(req.params);
            const courses = await listAdminSchoolCourses.exec({ schoolId });
            res.json({ courses });
        }));
    }

    if (listSchoolStudents) {
        const studentsQuerySchema = z.object({
            name: z.string().trim().min(1).optional(),
            courseId: z.string().uuid().optional(),
            classId: z.string().uuid().optional(),
            limit: z.coerce.number().int().positive().max(100).optional(),
            offset: z.coerce.number().int().min(0).optional()
        });
        router.get('/schools/:schoolId/students', requireAuth, requireAdminPersona, asyncHandler(async (req, res) => {
            const paramsSchema = z.object({ schoolId: z.string().uuid() });
            const { schoolId } = paramsSchema.parse(req.params);
            const query = studentsQuerySchema.parse({
                name: typeof req.query.name === 'string' ? req.query.name : undefined,
                courseId: typeof req.query.courseId === 'string' ? req.query.courseId : undefined,
                classId: typeof req.query.classId === 'string' ? req.query.classId : undefined,
                limit: req.query.limit,
                offset: req.query.offset
            });
            const result = await listSchoolStudents.exec({
                schoolId,
                name: query.name,
                courseId: query.courseId,
                classId: query.classId,
                limit: query.limit,
                offset: query.offset,
                outputFormat: 'admin'
            });
            res.json({
                students: result.students,
                pagination: {
                    total: result.total,
                    limit: result.limit,
                    offset: result.offset,
                    totalPage: Math.ceil(result.total / result.limit),
                    currentPage: Math.floor(result.offset / result.limit) + 1,
                    hasMore: result.offset + result.limit < result.total
                }
            });
        }));
    }

    // Cursos do aluno e dos dependentes (todas as escolas) – apenas studentId
    if (listAdminStudentCourses) {
        router.get('/students/:studentId/courses', requireAuth, requireAdminPersona, asyncHandler(async (req, res) => {
            const paramsSchema = z.object({
                studentId: z.string().uuid()
            });
            const { studentId } = paramsSchema.parse(req.params);
            const result = await listAdminStudentCourses.exec({ studentId });
            if (result === null) {
                return res.status(404).json({ error: 'Aluno não encontrado' });
            }
            res.json(result);
        }));
    }

    // Detalhes do estudante por ID (dados do aluno + dependentes + matrículas e cobranças de todas as escolas)
    if (getAdminStudentDetails) {
        router.get('/students/:studentId', requireAuth, requireAdminPersona, asyncHandler(async (req, res) => {
            const paramsSchema = z.object({
                studentId: z.string().uuid()
            });
            const { studentId } = paramsSchema.parse(req.params);
            const result = await getAdminStudentDetails.exec({ studentId });
            if (result === null) {
                return res.status(404).json({ error: 'Aluno não encontrado' });
            }
            res.json(result);
        }));
    }

    // Listar todos os estudantes do sistema (paginado, filtros: nome, escola, cpf)
    if (listAllStudents) {
        const allStudentsQuerySchema = z.object({
            name: z.string().trim().min(1).optional(),
            schoolId: z.string().uuid().optional(),
            cpf: z.string().trim().min(1).optional(),
            limit: z.coerce.number().int().positive().max(100).optional(),
            offset: z.coerce.number().int().min(0).optional()
        });
        router.get('/students', requireAuth, requireAdminPersona, asyncHandler(async (req, res) => {
            const query = allStudentsQuerySchema.parse({
                name: typeof req.query.name === 'string' ? req.query.name : undefined,
                schoolId: typeof req.query.schoolId === 'string' ? req.query.schoolId : undefined,
                cpf: typeof req.query.cpf === 'string' ? req.query.cpf : undefined,
                limit: req.query.limit,
                offset: req.query.offset
            });
            const result = await listAllStudents.exec({
                name: query.name,
                schoolId: query.schoolId,
                cpf: query.cpf,
                limit: query.limit,
                offset: query.offset
            });
            res.set('Cache-Control', 'no-store');
            // Evita 304 Not Modified para o cliente sempre receber a lista atualizada
            res.set('ETag', `"admin-students-${Date.now()}"`);
            res.json({
                students: result.items,
                pagination: {
                    total: result.total,
                    limit: result.limit,
                    offset: result.offset,
                    totalPage: Math.ceil(result.total / result.limit) || 1,
                    currentPage: Math.floor(result.offset / result.limit) + 1,
                    hasMore: result.offset + result.items.length < result.total
                }
            });
        }));
    }

    // Histórico de pagamentos (escolas com Minha Aula) - paginado e com filtros
    if (listAdminPaymentHistory) {
        const paymentHistoryQuerySchema = z.object({
            schoolName: z.string().trim().min(1).optional(),
            status: z.enum(['ISSUED', 'PAID', 'FAILED', 'CANCELLED']).optional(),
            month: z.coerce.number().int().min(1).max(12).optional(),
            year: z.coerce.number().int().min(2000).max(3000).optional(),
            limit: z.coerce.number().int().positive().max(100).optional(),
            offset: z.coerce.number().int().min(0).optional()
        });
        router.get('/payment-history', requireAuth, requireAdminPersona, asyncHandler(async (req, res) => {
            const query = paymentHistoryQuerySchema.parse({
                schoolName: typeof req.query.schoolName === 'string' ? req.query.schoolName : undefined,
                status: typeof req.query.status === 'string' ? req.query.status : undefined,
                month: req.query.month,
                year: req.query.year,
                limit: req.query.limit,
                offset: req.query.offset
            });
            const result = await listAdminPaymentHistory.exec({
                schoolName: query.schoolName,
                status: query.status,
                month: query.month,
                year: query.year,
                limit: query.limit,
                offset: query.offset
            });
            res.json({
                payments: result.items,
                pagination: {
                    total: result.total,
                    limit: result.limit,
                    offset: result.offset,
                    totalPage: Math.ceil(result.total / result.limit) || 1,
                    currentPage: Math.floor(result.offset / result.limit) + 1,
                    hasMore: result.offset + result.limit < result.total
                }
            });
        }));
    }

    if (scheduleChargeDueReminders) {
        router.post('/charge-due-reminders/trigger', requireAuth, requireAdminPersona, asyncHandler(async (_req, res) => {
            const result = await scheduleChargeDueReminders.exec(undefined);
            res.json({
                message: 'Job de lembretes de cobrança disparado. Emails enfileirados.',
                chargesEnqueued: result.chargesEnqueued,
                invoicesEnqueued: result.invoicesEnqueued,
                errors: result.errors
            });
        }));
    }

    if (adminMarkInvoicePaid) {
        const markInvoicePaidBodySchema = z.object({
            paidAt: z.string().datetime().optional()
        });
        router.post('/invoices/:invoiceId/mark-paid', requireAuth, requireAdminPersona, asyncHandler(async (req, res) => {
            const paramsSchema = z.object({ invoiceId: z.string().uuid() });
            const { invoiceId } = paramsSchema.parse(req.params);
            const body = markInvoicePaidBodySchema.parse(req.body ?? {});
            const paidAt = body.paidAt ? new Date(body.paidAt) : undefined;
            const result = await adminMarkInvoicePaid.exec({ invoiceId, paidAt });
            res.json(result);
        }));
    }

    if (adminMarkChargePaid) {
        const markChargePaidBodySchema = z.object({
            paidAt: z.string().datetime().optional()
        });
        router.post('/charges/:chargeId/mark-paid', requireAuth, requireAdminPersona, asyncHandler(async (req, res) => {
            const paramsSchema = z.object({ chargeId: z.string().uuid() });
            const { chargeId } = paramsSchema.parse(req.params);
            const body = markChargePaidBodySchema.parse(req.body ?? {});
            const paidAt = body.paidAt ? new Date(body.paidAt) : undefined;
            const result = await adminMarkChargePaid.exec({ chargeId, paidAt });
            res.json(result);
        }));
    }

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
            isActive: z.boolean().optional(),
            isPrimary: z.boolean().optional()
        });
        router.post('/plans', requireAuth, requireAdminPersona, asyncHandler(async (req, res) => {
            const body = createPlanSchema.parse(req.body);
            const payload = await createSubscriptionPlan.exec({
                code: body.code,
                name: body.name,
                description: body.description ?? null,
                items: body.items ?? null,
                amountCents: body.amountCents,
                currency: 'BRL',
                billingCycle: 'MONTHLY',
                isActive: body.isActive,
                isPrimary: body.isPrimary
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
            isActive: z.boolean().optional(),
            isPrimary: z.boolean().optional()
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

    // Rotas para conta Asaas da escola (gerar ou reenviar quando falhar)
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
        router.post('/schools/:schoolId/generate-asaas-account', requireAuth, requireAdminPersona, asyncHandler(async (req, res) => {
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

    // Fila de jobs (BullMQ) – apenas leitura
    router.get('/queue/jobs', requireAuth, requireAdminPersona, asyncHandler(async (req, res) => {
        if (!process.env.REDIS_HOST) {
            return res.status(503).json({
                error: 'Queue not configured',
                message: 'REDIS_HOST não está configurado. A fila de jobs não está disponível.'
            });
        }

        const querySchema = z.object({
            waitingLimit: z.coerce.number().int().min(1).max(200).optional(),
            failedLimit: z.coerce.number().int().min(1).max(200).optional(),
            completedLimit: z.coerce.number().int().min(1).max(100).optional()
        });
        const query = querySchema.parse(req.query);
        const waitingLimit = query.waitingLimit ?? 50;
        const failedLimit = query.failedLimit ?? 20;
        const completedLimit = query.completedLimit ?? 20;

        const connection = {
            host: process.env.REDIS_HOST,
            port: +(process.env.REDIS_PORT ?? 6379),
            ...(process.env.REDIS_USER ? { username: process.env.REDIS_USER } : {}),
            ...(process.env.REDIS_PASSWORD ? { password: process.env.REDIS_PASSWORD } : {}),
        };

        const queue = new Queue('outbox', { connection });

        try {
            const [repeatableJobs, waiting, active, failed, completed, workers] = await Promise.all([
                queue.getRepeatableJobs(),
                queue.getWaiting(0, waitingLimit - 1),
                queue.getActive(),
                queue.getFailed(0, failedLimit - 1),
                queue.getCompleted(0, completedLimit - 1),
                queue.getWorkers()
            ]);

            const toJobSummary = (job: { id?: string; name?: string; data?: { type?: string; payload?: unknown; aggregateId?: string }; failedReason?: string; attemptsMade?: number; finishedOn?: number }) => {
                const data = job.data as { type?: string; payload?: unknown; aggregateId?: string } | undefined;
                return {
                    id: job.id,
                    name: job.name,
                    type: data?.type ?? job.name,
                    aggregateId: data?.aggregateId ?? null,
                    payload: data?.payload ?? null,
                    ...(job.failedReason !== undefined && { failedReason: job.failedReason, attemptsMade: job.attemptsMade }),
                    ...(job.finishedOn !== undefined && { finishedOn: job.finishedOn })
                };
            };

            const payload = {
                repeatable: repeatableJobs.map((j) => ({
                    name: j.name,
                    pattern: j.pattern,
                    next: j.next ? new Date(j.next).toISOString() : null,
                    key: j.key
                })),
                counts: {
                    waiting: await queue.getWaitingCount(),
                    active: await queue.getActiveCount(),
                    completed: await queue.getCompletedCount(),
                    failed: await queue.getFailedCount()
                },
                workers: workers.length,
                waiting: waiting.map(toJobSummary),
                active: active.map(toJobSummary),
                failed: failed.map(toJobSummary),
                completed: completed.map(toJobSummary)
            };

            res.json(payload);
        } finally {
            await queue.close();
        }
    }));

    return router;
}
