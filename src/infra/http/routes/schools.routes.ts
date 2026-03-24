import { Router, type RequestHandler } from 'express';
import type { CreateSchool } from '../../../app/use-cases/create-school';
import type { CreateCourse } from '../../../app/use-cases/create-course';
import type { CreateCourseClass } from '../../../app/use-cases/create-course-class';
import type { UpdateCourseClass } from '../../../app/use-cases/update-course-class';
import type { ScheduleClassSession } from '../../../app/use-cases/schedule-class-session';
import type { ListClassSessions } from '../../../app/use-cases/list-class-sessions';
import type { CancelClassSession } from '../../../app/use-cases/cancel-class-session';
import type { LoginSchool } from '../../../app/use-cases/login-school';
import type { GetActiveSchoolPlan } from '../../../app/use-cases/get-active-school-plan';
import type { ListSubscriptionPlans } from '../../../app/use-cases/list-subscription-plans';
import type { AssignSchoolPlan } from '../../../app/use-cases/assign-school-plan';
import type { IssueSchoolPlanInvoice } from '../../../app/use-cases/issue-school-plan-invoice';
import type { ListSchoolPlanInvoices } from '../../../app/use-cases/list-school-plan-invoices';
import type { ListCategories } from '../../../app/use-cases/list-categories';
import type { ListSchoolCourses } from '../../../app/use-cases/list-school-courses';
import type { ListSchoolStudents } from '../../../app/use-cases/list-school-students';
import type { ListSchoolPayments } from '../../../app/use-cases/list-school-payments';
import type { ListPaidSchoolPayments } from '../../../app/use-cases/list-paid-school-payments';
import type { ConsolidateSchoolPayments } from '../../../app/use-cases/consolidate-school-payments';
import type { GetSchoolCourse } from '../../../app/use-cases/get-school-course';
import type { ListCourseClasses } from '../../../app/use-cases/list-course-classes';
import type { GetCourseClass } from '../../../app/use-cases/get-course-class';
import type { GetSchoolProfile } from '../../../app/use-cases/get-school-profile';
import type { UpdateSchool } from '../../../app/use-cases/update-school';
import type { UpdateCourse } from '../../../app/use-cases/update-course';
import type { EnrollStudent } from '../../../app/use-cases/enroll-student';
import type { ListEnrollmentRequests } from '../../../app/use-cases/list-enrollment-requests';
import type { DeleteCourse } from '../../../app/use-cases/delete-course';
import type { DeleteCourseClass } from '../../../app/use-cases/delete-course-class';
import type { CreateSchoolCharge } from '../../../app/use-cases/create-school-charge';
import { requirePersona } from '../middlewares/require-persona';
import { UserPersonaEnum } from '../../../domain/value-objects/user-persona';
import type { SchoolRepository } from '../../../ports/repositories/school.repo';
import { buildPublicSchoolRoutes } from './schools/public.routes';
import { buildProfileRoutes } from './schools/profile.routes';
import { buildPlansRoutes } from './schools/plans.routes';
import { buildCouponsRoutes } from './schools/coupons.routes';
import { buildCoursesRoutes } from './schools/courses.routes';
import { buildStudentsRoutes } from './schools/students.routes';
import { buildPaymentsRoutes } from './schools/payments.routes';
import { buildSessionsRoutes } from './schools/sessions.routes';
import { buildFinanceRoutes } from './schools/finance.routes';
import { buildBankAccountsRoutes } from './schools/bank-accounts.routes';
import { buildNotificationsRoutes } from './schools/notifications.routes';
import { buildKycRoutes } from './schools/kyc.routes';
import type { SchoolRouteGuards } from './schools/guards';
import { makeResolveSchoolContextMiddleware } from '../middlewares/resolve-school-context';
import type { ListSchoolBankAccounts } from '../../../app/use-cases/list-school-bank-accounts';
import type { CreateSchoolBankAccount } from '../../../app/use-cases/create-school-bank-account';
import type { UpdateSchoolBankAccount } from '../../../app/use-cases/update-school-bank-account';
import type { DeleteSchoolBankAccount } from '../../../app/use-cases/delete-school-bank-account';
import type { ListSchoolNotifications } from '../../../app/use-cases/list-school-notifications';
import type { SendClassPushNotification } from '../../../app/use-cases/send-class-push-notification';
import type { RequestPasswordReset } from '../../../app/use-cases/request-password-reset';
import type { ResetPassword } from '../../../app/use-cases/reset-password';
import type { UpdateSchoolPassword } from '../../../app/use-cases/update-school-password';
import type { GetStudentDirectoryEntry } from '../../../app/use-cases/get-student-directory-entry';
import { buildPasswordResetRoutes } from './schools/password-reset.routes';
import { buildDashboardRoutes } from './schools/dashboard.routes';
import { buildImagesRoutes } from './schools/images.routes';
import { z } from 'zod';
import { asyncHandler } from '../utils/async-handler';
import { AuthenticatedRequest } from '../middlewares/auth';

export type SchoolsRouterDeps = {
    createSchool: CreateSchool;
    createCourse: CreateCourse;
    createCourseClass: CreateCourseClass;
    updateCourseClass?: UpdateCourseClass;
    scheduleClassSession: ScheduleClassSession;
    listClassSessions: ListClassSessions;
    cancelClassSession: CancelClassSession;
    loginSchool?: LoginSchool;
    getActiveSchoolPlan?: GetActiveSchoolPlan;
    listSubscriptionPlans?: ListSubscriptionPlans;
    assignSchoolPlan?: AssignSchoolPlan;
    issueSchoolPlanInvoice?: IssueSchoolPlanInvoice;
    listSchoolPlanInvoices?: ListSchoolPlanInvoices;
    listCategories?: ListCategories;
    listSchoolCourses?: ListSchoolCourses;
    listSchoolStudents?: ListSchoolStudents;
    listSchoolPayments?: ListSchoolPayments;
    listPaidSchoolPayments?: ListPaidSchoolPayments;
    consolidateSchoolPayments?: ConsolidateSchoolPayments;
    getSchoolCourse?: GetSchoolCourse;
    updateCourse?: UpdateCourse;
    deleteCourse?: DeleteCourse;
    listCourseClasses?: ListCourseClasses;
    getCourseClass?: GetCourseClass;
    deleteCourseClass?: DeleteCourseClass;
    getSchoolProfile?: GetSchoolProfile;
    updateSchool?: UpdateSchool;
    enrollStudent?: EnrollStudent;
    listEnrollmentRequests?: ListEnrollmentRequests;
    authMiddleware?: RequestHandler;
    schoolsRepo?: SchoolRepository;
    createSchoolCharge?: CreateSchoolCharge;
    getSchoolFinancialSummary?: import('../../../app/use-cases/get-school-financial-summary').GetSchoolFinancialSummary;
    listSchoolWithdrawals?: import('../../../app/use-cases/list-school-withdrawals').ListSchoolWithdrawals;
    requestSchoolWithdrawal?: import('../../../app/use-cases/request-school-withdrawal').RequestSchoolWithdrawal;
    getSchoolBalance?: import('../../../app/use-cases/get-school-balance').GetSchoolBalance;
    schoolMarkChargePaid?: import('../../../app/use-cases/school-mark-charge-paid').SchoolMarkChargePaid;
    listSchoolBankAccounts?: ListSchoolBankAccounts;
    createSchoolBankAccount?: CreateSchoolBankAccount;
    updateSchoolBankAccount?: UpdateSchoolBankAccount;
    deleteSchoolBankAccount?: DeleteSchoolBankAccount;
    requestPasswordReset?: RequestPasswordReset;
    resetPassword?: ResetPassword;
    validatePasswordResetToken?: import('../../../app/use-cases/validate-password-reset-token').ValidatePasswordResetToken;
    updateSchoolPassword?: UpdateSchoolPassword;
    getStudentDirectoryEntry?: GetStudentDirectoryEntry;
    getSchoolStudentDetails?: import('../../../app/use-cases/get-school-student-details').GetSchoolStudentDetails;
    listSchoolStudentPaidCharges?: import('../../../app/use-cases/list-school-student-paid-charges').ListSchoolStudentPaidCharges;
    consolidateSchoolStudentFinancial?: import('../../../app/use-cases/consolidate-school-student-financial').ConsolidateSchoolStudentFinancial;
    getSchoolDashboard?: import('../../../app/use-cases/get-school-dashboard').GetSchoolDashboard;
    uploadSchoolImage?: import('../../../app/use-cases/upload-school-image').UploadSchoolImage;
    listSchoolImages?: import('../../../app/use-cases/list-school-images').ListSchoolImages;
    validateSchoolCoupon?: import('../../../app/use-cases/validate-school-coupon').ValidateSchoolCoupon;
    listSchoolNotifications?: ListSchoolNotifications;
    sendClassPushNotification?: SendClassPushNotification;
    getSchoolPendingDocuments?: import('../../../app/use-cases/get-school-pending-documents').GetSchoolPendingDocuments;
    syncSchoolOnboardingDocuments?: import('../../../app/use-cases/sync-school-onboarding-documents').SyncSchoolOnboardingDocuments;
    uploadSchoolOnboardingDocument?: import('../../../app/use-cases/admin-upload-school-onboarding-document').AdminUploadSchoolOnboardingDocument;
};

export function schoolsRouter(deps: SchoolsRouterDeps) {
    const router = Router();
    const { requireAuth, optionalAuth } = buildAuthGuards(deps.authMiddleware);
    const requireSchoolPersona = requirePersona(UserPersonaEnum.SCHOOL);
    const resolveSchoolContext = makeResolveSchoolContextMiddleware(deps.schoolsRepo);
    const guards: SchoolRouteGuards = {
        requireAuth,
        requireSchoolPersona,
        resolveSchoolContext
    };

    router.use(buildPublicSchoolRoutes({
        createSchool: deps.createSchool,
        loginSchool: deps.loginSchool,
        listCategories: deps.listCategories,
        listSubscriptionPlans: deps.listSubscriptionPlans
    }, optionalAuth));

    router.use(buildProfileRoutes({
        getSchoolProfile: deps.getSchoolProfile,
        updateSchool: deps.updateSchool
    }, guards));

    router.use(buildPlansRoutes({
        assignSchoolPlan: deps.assignSchoolPlan,
        getActiveSchoolPlan: deps.getActiveSchoolPlan,
        issueSchoolPlanInvoice: deps.issueSchoolPlanInvoice,
        listSchoolPlanInvoices: deps.listSchoolPlanInvoices
    }, guards));

    router.use('/coupons', buildCouponsRoutes({
        validateSchoolCoupon: deps.validateSchoolCoupon
    }, guards));

    if (deps.getSchoolDashboard) {
        router.use('/dashboard', buildDashboardRoutes({
            getSchoolDashboard: deps.getSchoolDashboard
        }, guards));
    }

    if (deps.uploadSchoolImage || deps.listSchoolImages) {
        router.use('/images', buildImagesRoutes({
            uploadSchoolImage: deps.uploadSchoolImage,
            listSchoolImages: deps.listSchoolImages
        }, guards));
    }

    if (deps.createSchoolCharge || deps.getSchoolFinancialSummary || deps.listSchoolWithdrawals || deps.requestSchoolWithdrawal || deps.getSchoolBalance || deps.schoolMarkChargePaid) {
        router.use('/finance', buildFinanceRoutes({
            createSchoolCharge: deps.createSchoolCharge,
            getSchoolFinancialSummary: deps.getSchoolFinancialSummary,
            listSchoolWithdrawals: deps.listSchoolWithdrawals,
            requestSchoolWithdrawal: deps.requestSchoolWithdrawal,
            getSchoolBalance: deps.getSchoolBalance,
            schoolMarkChargePaid: deps.schoolMarkChargePaid
        }, guards));
    }

    if (deps.listSchoolStudents) {
        router.use('/students', buildStudentsRoutes({
            listSchoolStudents: deps.listSchoolStudents,
            getStudentDirectoryEntry: deps.getStudentDirectoryEntry,
            getSchoolStudentDetails: deps.getSchoolStudentDetails,
            listSchoolStudentPaidCharges: deps.listSchoolStudentPaidCharges,
            consolidateSchoolStudentFinancial: deps.consolidateSchoolStudentFinancial
        }, guards));
    }

    if (deps.listSchoolPayments) {
        router.use('/payments', buildPaymentsRoutes({
            listSchoolPayments: deps.listSchoolPayments,
            listPaidSchoolPayments: deps.listPaidSchoolPayments,
            consolidateSchoolPayments: deps.consolidateSchoolPayments
        }, guards));
    }

    router.use('/courses', buildCoursesRoutes({
        createCourse: deps.createCourse,
        updateCourse: deps.updateCourse,
        updateCourseClass: deps.updateCourseClass,
        deleteCourse: deps.deleteCourse,
        listSchoolCourses: deps.listSchoolCourses,
        getSchoolCourse: deps.getSchoolCourse,
        createCourseClass: deps.createCourseClass,
        deleteCourseClass: deps.deleteCourseClass,
        listCourseClasses: deps.listCourseClasses,
        getCourseClass: deps.getCourseClass,
        scheduleClassSession: deps.scheduleClassSession,
        listClassSessions: deps.listClassSessions,
        enrollStudent: deps.enrollStudent,
        listEnrollmentRequests: deps.listEnrollmentRequests
    }, guards));

    router.use(buildSessionsRoutes({
        listClassSessions: deps.listClassSessions,
        cancelClassSession: deps.cancelClassSession
    }, guards));

    if (deps.listSchoolNotifications) {
        router.use('/notifications', buildNotificationsRoutes({
            listSchoolNotifications: deps.listSchoolNotifications,
            sendClassPushNotification: deps.sendClassPushNotification
        }, guards));
    }

    if (deps.getSchoolPendingDocuments) {
        router.use('/kyc', buildKycRoutes({
            getSchoolPendingDocuments: deps.getSchoolPendingDocuments,
            syncSchoolOnboardingDocuments: deps.syncSchoolOnboardingDocuments,
            uploadSchoolOnboardingDocument: deps.uploadSchoolOnboardingDocument
        }, guards));
    }

    router.use('/bank-accounts', buildBankAccountsRoutes({
        listSchoolBankAccounts: deps.listSchoolBankAccounts,
        createSchoolBankAccount: deps.createSchoolBankAccount,
        updateSchoolBankAccount: deps.updateSchoolBankAccount,
        deleteSchoolBankAccount: deps.deleteSchoolBankAccount
    }, guards));

    // Rota protegida de alteração de senha (quando logado)
    if (deps.updateSchoolPassword) {
        const updatePasswordSchema = z.object({
            currentPassword: z.string().min(6, 'A senha atual deve ter pelo menos 6 caracteres'),
            newPassword: z.string().min(6, 'A nova senha deve ter pelo menos 6 caracteres')
        });

        router.patch('/password', requireAuth, requireSchoolPersona, asyncHandler(async (req, res) => {
            const data = updatePasswordSchema.parse(req.body);
            const authReq = req as AuthenticatedRequest;
            const schoolId = authReq.user?.sub;

            if (!schoolId) {
                return res.status(401).json({ error: 'Não autenticado' });
            }

            await deps.updateSchoolPassword!.exec({
                schoolId,
                currentPassword: data.currentPassword,
                newPassword: data.newPassword
            });

            res.status(204).send();
        }));
    }

    // Rotas públicas de reset de senha
    router.use('/password', buildPasswordResetRoutes({
        requestPasswordReset: deps.requestPasswordReset,
        resetPassword: deps.resetPassword,
        validatePasswordResetToken: deps.validatePasswordResetToken
    }));

    return router;
}

function buildAuthGuards(authMiddleware?: RequestHandler) {
    const requireAuth: RequestHandler = authMiddleware ?? ((_req, _res, next) => next());
    const optionalAuth: RequestHandler = authMiddleware
        ? (req, res, next) => {
            if (!req.headers.authorization) {
                next();
                return;
            }
            authMiddleware(req, res, next);
        }
        : (_req, _res, next) => next();

    return { requireAuth, optionalAuth };
}
