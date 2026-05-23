import { Router, type RequestHandler } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { phoneNumberSchema } from '../validators/numeric-fields';
import { Queue } from 'bullmq';
import { asyncHandler } from '../utils/async-handler';
import { GetAdminStatus } from '../../../app/use-cases/admin/get-admin-status';
import { ListSchoolsWithPlans } from '../../../app/use-cases/admin/list-schools-with-plans';
import { LoginAdmin } from '../../../app/use-cases/auth/login-admin';
import { GetAdminDashboard } from '../../../app/use-cases/admin/get-admin-dashboard';
import { requirePersona } from '../middlewares/require-persona';
import { authRateLimiter } from '../middlewares/rate-limiter';
import { UserPersonaEnum } from '../../../domain/value-objects/user-persona';
import { adminDiscountCouponCreateBodySchema, buildCouponsRoutes } from './admin/coupons.routes';
import type { SchoolRepository } from '../../../ports/repositories/school.repo';
import type { ResendSchoolAsaasAccount } from '../../../app/use-cases/schools/resend-school-asaas-account';
import { GetAdminSchoolDetails } from '../../../app/use-cases/admin/get-admin-school-details';
import { GetAdminSchoolPlans } from '../../../app/use-cases/admin/get-admin-school-plans';
import { UpdateSchool } from '../../../app/use-cases/schools/update-school';
import type { AdminUpdateSchoolRegistration } from '../../../app/use-cases/admin/admin-update-school-registration';
import { updateSchoolSchema } from '../validators/school-schemas';
import { mapAddresses } from './schools/transformers';
import type { ListAdminSubscriptionPlans } from '../../../app/use-cases/admin/list-admin-subscription-plans';
import type { CreateSubscriptionPlan } from '../../../app/use-cases/admin/create-subscription-plan';
import type { UpdateSubscriptionPlan } from '../../../app/use-cases/admin/update-subscription-plan';
import type { ListAdminCategories } from '../../../app/use-cases/admin/list-admin-categories';
import type { CreateCategory } from '../../../app/use-cases/admin/create-category';
import type { UpdateCategory } from '../../../app/use-cases/admin/update-category';
import type { ListSchoolStudents } from '../../../app/use-cases/schools/list-school-students';
import type { ListAllStudents } from '../../../app/use-cases/admin/list-all-students';
import type { ListAdminStudentCourses } from '../../../app/use-cases/admin/list-admin-student-courses';
import type { GetAdminStudentDetails } from '../../../app/use-cases/admin/get-admin-student-details';
import type { UpdateAdminStudent } from '../../../app/use-cases/admin/update-admin-student';
import { adminPatchStudentSchema } from '../validators/admin-update-student-schemas';
import type { ListAdminSchoolCourses } from '../../../app/use-cases/admin/list-admin-school-courses';
import type { GetAdminSchoolFinancial } from '../../../app/use-cases/admin/get-admin-school-financial';
import type { GetAdminSchoolBilling } from '../../../app/use-cases/admin/get-admin-school-billing';
import type { ListAdminSchoolInvoices } from '../../../app/use-cases/admin/list-admin-school-invoices';
import type { ListAdminPaymentHistory } from '../../../app/use-cases/admin/list-admin-payment-history';
import type { ListAdminEnrollmentRequests } from '../../../app/use-cases/admin/list-admin-enrollment-requests';
import type { ListAdminStudentCharges } from '../../../app/use-cases/admin/list-admin-student-charges';
import type { ScheduleChargeDueReminders } from '../../../app/use-cases/payments/schedule-charge-due-reminders';
import type { AdminMarkInvoicePaid } from '../../../app/use-cases/admin/admin-mark-invoice-paid';
import type { AdminMarkChargePaid } from '../../../app/use-cases/admin/admin-mark-charge-paid';
import type { AdminDeleteCharge } from '../../../app/use-cases/admin/admin-delete-charge';
import type { UnenrollStudentFromClass } from '../../../app/use-cases/enrollments/unenroll-student-from-class';
import type { SyncSchoolOnboardingDocuments } from '../../../app/use-cases/schools/sync-school-onboarding-documents';
import type { AdminUploadSchoolOnboardingDocument } from '../../../app/use-cases/admin/admin-upload-school-onboarding-document';
import type { GetSchoolPendingDocuments } from '../../../app/use-cases/schools/get-school-pending-documents';
import type { SyncSchoolSubaccountStatus } from '../../../app/use-cases/schools/sync-school-subaccount-status';
import type { ListAdminJobLogs } from '../../../app/use-cases/admin/list-admin-job-logs';
import type { GetAdminJobLog } from '../../../app/use-cases/admin/get-admin-job-log';
import type { AdminSoftDeleteUser } from '../../../app/use-cases/admin/admin-soft-delete-user';
import type { AdminSoftDeleteSchool } from '../../../app/use-cases/admin/admin-soft-delete-school';
import { AppError, ErrorCode } from '../../../shared/errors';
import { connection, getOutboxQueueName } from '../../messaging/bullmq/queue-config';
import { CronLogRepositoryAdapter } from '../../db/typeorm/cron-log-repository.adapter';
import { EventLogRepositoryAdapter } from '../../db/typeorm/event-log-repository.adapter';

const documentUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
        const allowed = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
        if (allowed.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Tipo não permitido. Use PDF ou imagem (JPEG/PNG).'));
        }
    }
});

type AdminRouterDeps = {
    getAdminStatus: GetAdminStatus;
    listSchoolsWithPlans: ListSchoolsWithPlans;
    loginAdmin: LoginAdmin;
    getAdminDashboard?: GetAdminDashboard;
    getAdminSchoolDetails: GetAdminSchoolDetails;
    getAdminSchoolPlans: GetAdminSchoolPlans;
    updateSchool: UpdateSchool;
    adminUpdateSchoolRegistration?: AdminUpdateSchoolRegistration;
    listAdminSubscriptionPlans?: ListAdminSubscriptionPlans;
    createSubscriptionPlan?: CreateSubscriptionPlan;
    updateSubscriptionPlan?: UpdateSubscriptionPlan;
    listAdminCategories?: ListAdminCategories;
    createCategory?: CreateCategory;
    updateCategory?: UpdateCategory;
    createDiscountCoupon?: import('../../../app/use-cases/admin/create-discount-coupon').CreateDiscountCoupon;
    listDiscountCoupons?: import('../../../app/use-cases/admin/list-discount-coupons').ListDiscountCoupons;
    validateDiscountCoupon?: import('../../../app/use-cases/admin/validate-discount-coupon').ValidateDiscountCoupon;
    /** Usado para validar escola nas rotas /admin/schools/:schoolId/plans/coupons */
    schoolsRepo: SchoolRepository;
    resendSchoolAsaasAccount?: ResendSchoolAsaasAccount;
    listSchoolStudents?: ListSchoolStudents;
    listAllStudents?: ListAllStudents;
    listAdminStudentCourses?: ListAdminStudentCourses;
    getAdminStudentDetails?: GetAdminStudentDetails;
    updateAdminStudent?: UpdateAdminStudent;
    listAdminSchoolCourses?: ListAdminSchoolCourses;
    getAdminSchoolFinancial?: GetAdminSchoolFinancial;
    getAdminSchoolBilling?: GetAdminSchoolBilling;
    listAdminSchoolInvoices?: ListAdminSchoolInvoices;
    listAdminPaymentHistory?: ListAdminPaymentHistory;
    listAdminEnrollmentRequests?: ListAdminEnrollmentRequests;
    listAdminStudentCharges?: ListAdminStudentCharges;
    adminMarkInvoicePaid?: AdminMarkInvoicePaid;
    adminMarkChargePaid?: AdminMarkChargePaid;
    adminDeleteCharge?: AdminDeleteCharge;
    unenrollStudentFromClass?: UnenrollStudentFromClass;
    syncSchoolOnboardingDocuments?: SyncSchoolOnboardingDocuments;
    adminUploadSchoolOnboardingDocument?: AdminUploadSchoolOnboardingDocument;
    getSchoolPendingDocuments?: GetSchoolPendingDocuments;
    syncSchoolSubaccountStatus?: SyncSchoolSubaccountStatus;
    scheduleChargeDueReminders?: ScheduleChargeDueReminders;
    listAdminJobLogs?: ListAdminJobLogs;
    getAdminJobLog?: GetAdminJobLog;
    adminSoftDeleteUser?: AdminSoftDeleteUser;
    adminSoftDeleteSchool?: AdminSoftDeleteSchool;
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
    adminUpdateSchoolRegistration,
    listAdminSubscriptionPlans,
    createSubscriptionPlan,
    updateSubscriptionPlan,
    listAdminCategories,
    createCategory,
    updateCategory,
    createDiscountCoupon,
    listDiscountCoupons,
    validateDiscountCoupon,
    schoolsRepo,
    resendSchoolAsaasAccount,
    listSchoolStudents,
    listAllStudents,
    listAdminStudentCourses,
    getAdminStudentDetails,
    updateAdminStudent,
    listAdminSchoolCourses,
    getAdminSchoolFinancial,
    getAdminSchoolBilling,
    listAdminSchoolInvoices,
    listAdminPaymentHistory,
    listAdminEnrollmentRequests,
    listAdminStudentCharges,
    adminMarkInvoicePaid,
    adminMarkChargePaid,
    adminDeleteCharge,
    unenrollStudentFromClass,
    syncSchoolOnboardingDocuments,
    adminUploadSchoolOnboardingDocument,
    getSchoolPendingDocuments,
    syncSchoolSubaccountStatus,
    scheduleChargeDueReminders,
    listAdminJobLogs,
    getAdminJobLog,
    adminSoftDeleteUser,
    adminSoftDeleteSchool,
    authMiddleware
}: AdminRouterDeps) {
    const router = Router();
    const { requireAuth } = buildAuthGuards(authMiddleware);
    const requireAdminPersona = requirePersona(UserPersonaEnum.ADMIN);

    const cronLogsRepo = new CronLogRepositoryAdapter();
    const eventLogsRepo = new EventLogRepositoryAdapter();

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
            ownerWhatsapp: z.union([z.null(), phoneNumberSchema()]).optional(),
            ownerUserId: z.string().uuid().nullable().optional(),
            ownerPassword: z.string().min(8).nullable().optional(),
            ownerStudentAccessEnabled: z.boolean().optional(),
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

    if (adminUpdateSchoolRegistration) {
        router.patch('/schools/:schoolId/registration', requireAuth, requireAdminPersona, asyncHandler(async (req, res) => {
            const paramsSchema = z.object({
                schoolId: z.string().uuid()
            });
            const { schoolId } = paramsSchema.parse(req.params);
            const data = updateSchoolSchema.parse(req.body ?? {});

            await adminUpdateSchoolRegistration.exec({
                schoolId,
                name: data.name,
                email: data.email,
                phone: data.phone,
                cnpj: data.cnpj,
                addresses: mapAddresses(data.addresses),
                ownerName: data.ownerName === undefined ? undefined : data.ownerName,
                ownerCpf: data.ownerCpf === undefined ? undefined : data.ownerCpf,
                ownerEmail: data.ownerEmail === undefined ? undefined : data.ownerEmail,
                ownerBirthDate: data.ownerBirthDate === undefined ? undefined : data.ownerBirthDate,
                ownerWhatsapp: data.ownerWhatsapp === undefined ? undefined : data.ownerWhatsapp,
                ownerUserId: data.ownerUserId === undefined ? undefined : data.ownerUserId,
                ownerPassword: data.ownerPassword === undefined ? undefined : data.ownerPassword,
                ownerStudentAccessEnabled: data.ownerStudentAccessEnabled,
                incomeValue: data.incomeValue === undefined ? undefined : data.incomeValue,
                links: data.links
            });

            const payload = await getAdminSchoolDetails.exec({ schoolId });
            res.json(payload);
        }));
    }

    if (adminSoftDeleteSchool) {
        router.delete('/schools/:schoolId', requireAuth, requireAdminPersona, asyncHandler(async (req, res) => {
            const paramsSchema = z.object({ schoolId: z.string().uuid() });
            const bodySchema = z.object({
                deleteOwnerUser: z.boolean().optional(),
                ownerDeletionDescription: z.string().max(2000).nullable().optional()
            }).strict();

            const { schoolId } = paramsSchema.parse(req.params);
            const body = bodySchema.parse(req.body ?? {});

            const result = await adminSoftDeleteSchool.exec({
                schoolId,
                deleteOwnerUser: body.deleteOwnerUser ?? false,
                ownerDeletionDescription: body.ownerDeletionDescription ?? null
            });
            res.json(result);
        }));
    }

    if (adminSoftDeleteUser) {
        router.delete('/users/:userId', requireAuth, requireAdminPersona, asyncHandler(async (req, res) => {
            const paramsSchema = z.object({ userId: z.string().uuid() });
            const bodySchema = z.object({
                description: z.string().max(2000).nullable().optional()
            }).strict();

            const { userId } = paramsSchema.parse(req.params);
            const body = bodySchema.parse(req.body ?? {});

            const result = await adminSoftDeleteUser.exec({
                userId,
                description: body.description ?? null
            });
            res.json(result);
        }));
    }

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
        cnpj: z.string().trim().min(1).optional(),
        ownerCpf: z.string().trim().min(1).optional(),
        hasAsaasAccount: z.enum(['WITH', 'WITHOUT']).optional(),
        hasOnboardingUrl: z.enum(['WITH', 'WITHOUT']).optional(),
        firstPayment: z.enum(['YES', 'NO']).optional(),
        onboarding: z.enum(['YES', 'NO']).optional(),
        limit: z.coerce.number().int().positive().max(500).optional(),
        offset: z.coerce.number().int().min(0).optional()
    });
    router.get('/schools', requireAuth, requireAdminPersona, asyncHandler(async (req, res) => {
        const query = schoolsListQuerySchema.parse({
            name: typeof req.query.name === 'string' ? req.query.name : undefined,
            status: typeof req.query.status === 'string' ? req.query.status : undefined,
            paymentStatus: typeof req.query.paymentStatus === 'string' ? req.query.paymentStatus : undefined,
            cnpj: typeof req.query.cnpj === 'string' ? req.query.cnpj : undefined,
            ownerCpf: typeof req.query.ownerCpf === 'string' ? req.query.ownerCpf : undefined,
            hasAsaasAccount: typeof req.query.hasAsaasAccount === 'string' ? req.query.hasAsaasAccount : undefined,
            hasOnboardingUrl: typeof req.query.hasOnboardingUrl === 'string' ? req.query.hasOnboardingUrl : undefined,
            firstPayment: typeof req.query.firstPayment === 'string' ? req.query.firstPayment : undefined,
            onboarding: typeof req.query.onboarding === 'string' ? req.query.onboarding : undefined,
            limit: req.query.limit,
            offset: req.query.offset
        });
        const result = await listSchoolsWithPlans.exec({
            name: query.name,
            status: query.status,
            paymentStatus: query.paymentStatus,
            cnpj: query.cnpj,
            ownerCpf: query.ownerCpf,
            hasAsaasAccount: query.hasAsaasAccount,
            hasOnboardingUrl: query.hasOnboardingUrl,
            firstPayment: query.firstPayment,
            onboarding: query.onboarding,
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

    // Cupons de desconto dos planos (assinatura SaaS da escola) — mesmo payload que POST /admin/coupons, com escopo por escola na URL
    if (createDiscountCoupon) {
        router.post('/schools/:schoolId/plans/coupons', requireAuth, requireAdminPersona, asyncHandler(async (req, res) => {
            const paramsSchema = z.object({ schoolId: z.string().uuid() });
            const { schoolId } = paramsSchema.parse(req.params);
            const school = await schoolsRepo.findById(schoolId);
            if (!school) {
                throw AppError.fromCode(ErrorCode.SCHOOL_NOT_FOUND, { schoolId });
            }
            const data = adminDiscountCouponCreateBodySchema.parse(req.body);
            const result = await createDiscountCoupon.exec({
                code: data.code,
                percentage: data.percentage,
                validUntil: new Date(data.validUntil),
                durationMonths: data.durationMonths,
                isActive: data.isActive
            });
            res.status(201).json(result);
        }));
    }

    if (listDiscountCoupons) {
        router.get('/schools/:schoolId/plans/coupons', requireAuth, requireAdminPersona, asyncHandler(async (req, res) => {
            const paramsSchema = z.object({ schoolId: z.string().uuid() });
            const { schoolId } = paramsSchema.parse(req.params);
            const school = await schoolsRepo.findById(schoolId);
            if (!school) {
                throw AppError.fromCode(ErrorCode.SCHOOL_NOT_FOUND, { schoolId });
            }
            const result = await listDiscountCoupons.exec();
            res.json(result);
        }));
    }

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

    if (unenrollStudentFromClass) {
        const adminUnenrollParamsSchema = z.object({
            schoolId: z.string().uuid(),
            courseId: z.string().uuid(),
            classId: z.string().uuid(),
            enrollmentId: z.string().uuid()
        });

        router.delete(
            '/schools/:schoolId/courses/:courseId/classes/:classId/enrollments/:enrollmentId',
            requireAuth,
            requireAdminPersona,
            asyncHandler(async (req, res) => {
                const { schoolId, courseId, classId, enrollmentId } = adminUnenrollParamsSchema.parse(req.params);

                const result = await unenrollStudentFromClass.exec({
                    schoolId,
                    courseId,
                    classId,
                    enrollmentId
                });

                res.json(result);
            })
        );
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

    // Mensalidades do aluno em todas as escolas (sem filtro por schoolId)
    if (listAdminStudentCharges) {
        router.get('/students/:studentId/charges', requireAuth, requireAdminPersona, asyncHandler(async (req, res) => {
            const paramsSchema = z.object({
                studentId: z.string().uuid()
            });
            const { studentId } = paramsSchema.parse(req.params);
            const result = await listAdminStudentCharges.exec({ studentId });
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

    if (updateAdminStudent) {
        router.patch('/students/:studentId', requireAuth, requireAdminPersona, asyncHandler(async (req, res) => {
            const paramsSchema = z.object({
                studentId: z.string().uuid()
            });
            const { studentId } = paramsSchema.parse(req.params);
            const data = adminPatchStudentSchema.parse(req.body ?? {});

            const result = await updateAdminStudent.exec({
                studentId,
                fullName: data.fullName,
                email: data.email,
                phone: data.phone,
                cpf: data.cpf,
                birthDate: data.birthDate,
                address: data.address,
                gender: data.gender,
                relationship: data.relationship,
                status: data.status,
                deactivationDescription: data.deactivationDescription
            });

            res.json(result);
        }));
    }

    // Listar todos os estudantes do sistema (paginado, filtros: nome, escola, cpf)
    if (listAllStudents) {
        const allStudentsQuerySchema = z.object({
            name: z.string().trim().min(1).optional(),
            schoolId: z.string().uuid().optional(),
            cpf: z.string().trim().min(1).optional(),
            city: z.string().trim().min(1).optional(),
            limit: z.coerce.number().int().positive().max(100).optional(),
            offset: z.coerce.number().int().min(0).optional()
        });
        router.get('/students', requireAuth, requireAdminPersona, asyncHandler(async (req, res) => {
            const query = allStudentsQuerySchema.parse({
                name: typeof req.query.name === 'string' ? req.query.name : undefined,
                schoolId: typeof req.query.schoolId === 'string' ? req.query.schoolId : undefined,
                cpf: typeof req.query.cpf === 'string' ? req.query.cpf : undefined,
                city: typeof req.query.city === 'string' ? req.query.city : undefined,
                limit: req.query.limit,
                offset: req.query.offset
            });
            const result = await listAllStudents.exec({
                name: query.name,
                schoolId: query.schoolId,
                cpf: query.cpf,
                city: query.city,
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
            const payload: Record<string, unknown> = {
                payments: result.items,
                pagination: {
                    total: result.total,
                    limit: result.limit,
                    offset: result.offset,
                    totalPage: Math.ceil(result.total / result.limit) || 1,
                    currentPage: Math.floor(result.offset / result.limit) + 1,
                    hasMore: result.offset + result.limit < result.total
                }
            };
            if (result.summary) {
                payload.summary = {
                    balanceAvailableReais: result.summary.balanceAvailableReais,
                    totalReceivedCents: result.summary.totalReceivedCents,
                    totalOverdueCents: result.summary.totalOverdueCents
                };
            }
            res.json(payload);
        }));
    }

    // Pedidos de matrícula de todas as escolas
    if (listAdminEnrollmentRequests) {
        const enrollmentRequestsQuerySchema = z.object({
            studentName: z.string().trim().min(1).optional(),
            studentCpf: z.string().trim().min(1).optional(),
            schoolName: z.string().trim().min(1).optional(),
            status: z.enum(['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED']).optional(),
            limit: z.coerce.number().int().positive().max(100).optional(),
            offset: z.coerce.number().int().min(0).optional()
        });
        router.get('/enrollment-requests', requireAuth, requireAdminPersona, asyncHandler(async (req, res) => {
            const query = enrollmentRequestsQuerySchema.parse({
                studentName: typeof req.query.studentName === 'string' ? req.query.studentName : undefined,
                studentCpf: typeof req.query.studentCpf === 'string' ? req.query.studentCpf : undefined,
                schoolName: typeof req.query.schoolName === 'string' ? req.query.schoolName : undefined,
                status: typeof req.query.status === 'string' ? req.query.status : undefined,
                limit: req.query.limit,
                offset: req.query.offset
            });
            const result = await listAdminEnrollmentRequests.exec({
                studentName: query.studentName,
                studentCpf: query.studentCpf,
                schoolName: query.schoolName,
                status: query.status,
                limit: query.limit,
                offset: query.offset
            });
            res.json(result);
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

    if (adminDeleteCharge) {
        router.delete('/charges/:chargeId', requireAuth, requireAdminPersona, asyncHandler(async (req, res) => {
            const paramsSchema = z.object({ chargeId: z.string().uuid() });
            const { chargeId } = paramsSchema.parse(req.params);
            const result = await adminDeleteCharge.exec({ chargeId });
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
    if (getSchoolPendingDocuments) {
        router.get('/schools/:schoolId/kyc/documents', requireAuth, requireAdminPersona, asyncHandler(async (req, res) => {
            const paramsSchema = z.object({ schoolId: z.string().uuid() });
            const { schoolId } = paramsSchema.parse(req.params);
            const result = await getSchoolPendingDocuments.exec({ schoolId });
            res.json({
                documents: result.documents,
                onboardingUrl: result.onboardingUrl
            });
        }));
    }

    if (syncSchoolOnboardingDocuments) {
        router.post('/schools/:schoolId/sync-onboarding-documents', requireAuth, requireAdminPersona, asyncHandler(async (req, res) => {
            const paramsSchema = z.object({ schoolId: z.string().uuid() });
            const { schoolId } = paramsSchema.parse(req.params);
            const result = await syncSchoolOnboardingDocuments.exec({ schoolId });
            res.json(result);
        }));
    }

    if (syncSchoolSubaccountStatus) {
        router.post('/schools/:schoolId/sync-subaccount-status', requireAuth, requireAdminPersona, asyncHandler(async (req, res) => {
            const paramsSchema = z.object({ schoolId: z.string().uuid() });
            const { schoolId } = paramsSchema.parse(req.params);
            const result = await syncSchoolSubaccountStatus.exec({ schoolId });
            res.json(result);
        }));
    }

    if (adminUploadSchoolOnboardingDocument) {
        router.post('/schools/:schoolId/documents/:documentGroupId/upload', requireAuth, requireAdminPersona, documentUpload.single('documentFile'), asyncHandler(async (req, res) => {
            const paramsSchema = z.object({ schoolId: z.string().uuid(), documentGroupId: z.string().min(1) });
            const { schoolId, documentGroupId } = paramsSchema.parse(req.params);
            const type = z.string().min(1).parse(req.body?.type);
            const file = req.file;
            if (!file) {
                throw AppError.fromCode(ErrorCode.VALIDATION_ERROR, { message: 'Campo documentFile é obrigatório' });
            }
            const result = await adminUploadSchoolOnboardingDocument.exec({
                schoolId,
                documentGroupId,
                fileBuffer: file.buffer,
                mimeType: file.mimetype,
                type
            });
            res.json(result);
        }));
    }

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

    // Histórico persistido de execuções de jobs (worker / fila outbox)
    if (listAdminJobLogs && getAdminJobLog) {
        router.get('/job-logs', requireAuth, requireAdminPersona, asyncHandler(async (req, res) => {
            const querySchema = z.object({
                status: z.enum(['completed', 'failed']).optional(),
                jobName: z.string().min(1).max(128).optional(),
                from: z.coerce.date().optional(),
                to: z.coerce.date().optional(),
                limit: z.coerce.number().int().min(1).max(100).optional(),
                offset: z.coerce.number().int().min(0).optional()
            });
            const query = querySchema.parse(req.query);
            const result = await listAdminJobLogs.exec({
                status: query.status,
                jobName: query.jobName ?? null,
                from: query.from ?? null,
                to: query.to ?? null,
                limit: query.limit,
                offset: query.offset
            });
            res.json(result);
        }));

        router.get('/job-logs/:id', requireAuth, requireAdminPersona, asyncHandler(async (req, res) => {
            const paramsSchema = z.object({ id: z.string().uuid() });
            const { id } = paramsSchema.parse(req.params);
            const result = await getAdminJobLog.exec({ id });
            res.json(result);
        }));
    }

    async function getQueueSnapshot(query: unknown) {
        if (!process.env.REDIS_HOST) {
            throw AppError.fromCode(ErrorCode.VALIDATION_ERROR, {
                message: 'REDIS_HOST não está configurado. A fila de jobs não está disponível.'
            });
        }

        const querySchema = z.object({
            waitingLimit: z.coerce.number().int().min(1).max(200).optional(),
            failedLimit: z.coerce.number().int().min(1).max(200).optional(),
            completedLimit: z.coerce.number().int().min(1).max(100).optional()
        });
        const q = querySchema.parse(query);
        const waitingLimit = q.waitingLimit ?? 50;
        const failedLimit = q.failedLimit ?? 20;
        const completedLimit = q.completedLimit ?? 20;

        const queue = new Queue(getOutboxQueueName(), { connection });

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

            return {
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
        } finally {
            await queue.close();
        }
    }

    // Fila de jobs (BullMQ) – apenas leitura (compat)
    router.get('/queue/jobs', requireAuth, requireAdminPersona, asyncHandler(async (req, res) => {
        try {
            const payload = await getQueueSnapshot(req.query);
            res.json(payload);
        } catch (e) {
            if (e instanceof AppError && e.code === ErrorCode.VALIDATION_ERROR) {
                return res.status(503).json({
                    error: 'Queue not configured',
                    message: String(e.details?.message ?? 'Fila indisponível')
                });
            }
            throw e;
        }
    }));

    /**
     * Observabilidade (Admin): CRONs
     */
    router.get('/crons', requireAuth, requireAdminPersona, asyncHandler(async (_req, res) => {
        if (!process.env.REDIS_HOST) {
            return res.status(503).json({
                error: 'Queue not configured',
                message: 'REDIS_HOST não está configurado. Os CRONs (fila BullMQ) não estão disponíveis.'
            });
        }
        const queue = new Queue(getOutboxQueueName(), { connection });
        try {
            const repeatable = await queue.getRepeatableJobs();
            const uniqueNames = Array.from(new Set(repeatable.map((r) => r.name))).sort();
            const latest = await Promise.all(uniqueNames.map((name) => cronLogsRepo.findLatestByCronName(name)));
            const byName = new Map(uniqueNames.map((n, i) => [n, latest[i] ?? null]));

            res.json({
                items: uniqueNames.map((name) => {
                    const rep = repeatable.find((r) => r.name === name);
                    const last = byName.get(name);
                    return {
                        id: name,
                        cronName: name,
                        schedule: rep?.pattern ?? null,
                        next: rep?.next ? new Date(rep.next).toISOString() : null,
                        lastExecution: last
                            ? {
                                  id: last.id,
                                  startedAt: last.startedAt.toISOString(),
                                  finishedAt: last.finishedAt.toISOString(),
                                  status: last.status,
                                  errorMessage: last.errorMessage
                              }
                            : null
                    };
                }),
                total: uniqueNames.length
            });
        } finally {
            await queue.close();
        }
    }));

    router.get('/crons/:id/logs', requireAuth, requireAdminPersona, asyncHandler(async (req, res) => {
        const paramsSchema = z.object({ id: z.string().min(1).max(128) });
        const querySchema = z.object({
            status: z.enum(['completed', 'failed']).optional(),
            from: z.coerce.date().optional(),
            to: z.coerce.date().optional(),
            limit: z.coerce.number().int().min(1).max(100).optional(),
            offset: z.coerce.number().int().min(0).optional()
        });
        const { id } = paramsSchema.parse(req.params);
        const query = querySchema.parse(req.query);
        const limit = Math.min(100, Math.max(1, query.limit ?? 50));
        const offset = Math.max(0, query.offset ?? 0);

        const result = await cronLogsRepo.list({
            cronName: id,
            status: query.status,
            from: query.from,
            to: query.to,
            limit,
            offset
        });

        res.json({
            items: result.items.map((row) => ({
                id: row.id,
                cronName: row.cronName,
                startedAt: row.startedAt.toISOString(),
                finishedAt: row.finishedAt.toISOString(),
                status: row.status,
                errorMessage: row.errorMessage
            })),
            total: result.total,
            limit,
            offset
        });
    }));

    router.post('/crons/:id/run', requireAuth, requireAdminPersona, asyncHandler(async (req, res) => {
        if (!process.env.REDIS_HOST) {
            return res.status(503).json({
                error: 'Queue not configured',
                message: 'REDIS_HOST não está configurado. Não é possível executar CRON manualmente.'
            });
        }
        const paramsSchema = z.object({ id: z.string().min(1).max(128) });
        const { id } = paramsSchema.parse(req.params);

        const queue = new Queue(getOutboxQueueName(), { connection });
        try {
            const aggregateId = `admin-cron-run:${id}:${Date.now()}`;
            const job = await queue.add(
                id,
                { type: id, payload: {}, aggregateId },
                { removeOnComplete: true, attempts: 1 }
            );
            res.status(202).json({ enqueued: true, jobId: job.id ?? null, cronName: id });
        } finally {
            await queue.close();
        }
    }));

    /**
     * Observabilidade (Admin): Jobs (BullMQ)
     */
    router.get('/jobs', requireAuth, requireAdminPersona, asyncHandler(async (req, res) => {
        try {
            const payload = await getQueueSnapshot(req.query);
            res.json(payload);
        } catch (e) {
            if (e instanceof AppError && e.code === ErrorCode.VALIDATION_ERROR) {
                return res.status(503).json({
                    error: 'Queue not configured',
                    message: String(e.details?.message ?? 'Fila indisponível')
                });
            }
            throw e;
        }
    }));

    router.post('/jobs/:id/retry', requireAuth, requireAdminPersona, asyncHandler(async (req, res) => {
        if (!process.env.REDIS_HOST) {
            return res.status(503).json({
                error: 'Queue not configured',
                message: 'REDIS_HOST não está configurado. Não é possível dar retry manual.'
            });
        }
        const paramsSchema = z.object({ id: z.string().min(1).max(128) });
        const { id } = paramsSchema.parse(req.params);

        const queue = new Queue(getOutboxQueueName(), { connection });
        try {
            const job = await queue.getJob(id);
            if (!job) {
                throw AppError.notFound('Job', { id });
            }
            const state = await job.getState();
            if (state !== 'failed') {
                throw AppError.validation('Job não está em estado "failed"', { id, state });
            }
            await job.retry();
            res.status(202).json({ retried: true, id, stateBefore: state });
        } finally {
            await queue.close();
        }
    }));

    /**
     * Observabilidade (Admin): Eventos de disparo (push/whatsapp/etc.)
     */
    router.get('/events', requireAuth, requireAdminPersona, asyncHandler(async (req, res) => {
        const querySchema = z.object({
            type: z.string().min(1).max(128).optional(),
            status: z.enum(['completed', 'failed']).optional(),
            from: z.coerce.date().optional(),
            to: z.coerce.date().optional(),
            limit: z.coerce.number().int().min(1).max(100).optional(),
            offset: z.coerce.number().int().min(0).optional()
        });
        const query = querySchema.parse(req.query);
        const limit = Math.min(100, Math.max(1, query.limit ?? 50));
        const offset = Math.max(0, query.offset ?? 0);

        const result = await eventLogsRepo.list({
            type: query.type,
            status: query.status,
            from: query.from,
            to: query.to,
            limit,
            offset
        });

        res.json({
            items: result.items.map((row) => ({
                id: row.id,
                type: row.type,
                recipient: row.recipient,
                dispatchedAt: row.dispatchedAt.toISOString(),
                status: row.status,
                payload: row.payload,
                errorMessage: row.errorMessage
            })),
            total: result.total,
            limit,
            offset
        });
    }));

    router.get('/events/:id', requireAuth, requireAdminPersona, asyncHandler(async (req, res) => {
        const paramsSchema = z.object({ id: z.string().uuid() });
        const { id } = paramsSchema.parse(req.params);
        const row = await eventLogsRepo.findById(id);
        if (!row) {
            throw AppError.notFound('Evento', { id });
        }
        res.json({
            id: row.id,
            type: row.type,
            recipient: row.recipient,
            dispatchedAt: row.dispatchedAt.toISOString(),
            status: row.status,
            payload: row.payload,
            errorMessage: row.errorMessage
        });
    }));

    return router;
}
