import { Router, type RequestHandler } from 'express';
import type { CreateSchool } from '../../../app/use-cases/schools/create-school';
import type { CreateCourse } from '../../../app/use-cases/courses/create-course';
import type { CreateCourseClass } from '../../../app/use-cases/courses/create-course-class';
import type { UpdateCourseClass } from '../../../app/use-cases/courses/update-course-class';
import type { ScheduleClassSession } from '../../../app/use-cases/courses/schedule-class-session';
import type { ListClassSessions } from '../../../app/use-cases/courses/list-class-sessions';
import type { CancelClassSession } from '../../../app/use-cases/courses/cancel-class-session';
import type { LoginSchool } from '../../../app/use-cases/auth/login-school';
import type { GetActiveSchoolPlan } from '../../../app/use-cases/schools/get-active-school-plan';
import type { ListSubscriptionPlans } from '../../../app/use-cases/catalog/list-subscription-plans';
import type { AssignSchoolPlan } from '../../../app/use-cases/schools/assign-school-plan';
import type { IssueSchoolPlanInvoice } from '../../../app/use-cases/schools/issue-school-plan-invoice';
import type { ListSchoolPlanInvoices } from '../../../app/use-cases/schools/list-school-plan-invoices';
import type { ListCategories } from '../../../app/use-cases/catalog/list-categories';
import type { ListSchoolCourses } from '../../../app/use-cases/schools/list-school-courses';
import type { ListSchoolStudents } from '../../../app/use-cases/schools/list-school-students';
import type { ListSchoolPayments } from '../../../app/use-cases/schools/list-school-payments';
import type { ListPaidSchoolPayments } from '../../../app/use-cases/schools/list-paid-school-payments';
import type { ConsolidateSchoolPayments } from '../../../app/use-cases/schools/consolidate-school-payments';
import type { GetSchoolCourse } from '../../../app/use-cases/schools/get-school-course';
import type { ListCourseClasses } from '../../../app/use-cases/courses/list-course-classes';
import type { GetCourseClass } from '../../../app/use-cases/courses/get-course-class';
import type { GetSchoolProfile } from '../../../app/use-cases/schools/get-school-profile';
import type { UpdateSchool } from '../../../app/use-cases/schools/update-school';
import type { UpdateCourse } from '../../../app/use-cases/courses/update-course';
import type { EnrollStudent } from '../../../app/use-cases/enrollments/enroll-student';
import type { UnenrollStudentFromClass } from '../../../app/use-cases/enrollments/unenroll-student-from-class';
import type { ListEnrollmentRequests } from '../../../app/use-cases/enrollments/list-enrollment-requests';
import type { DeleteCourse } from '../../../app/use-cases/courses/delete-course';
import type { DeleteCourseClass } from '../../../app/use-cases/courses/delete-course-class';
import type { CreateSchoolCharge } from '../../../app/use-cases/schools/create-school-charge';
import type { GenerateTuitionPix } from '../../../app/use-cases/payments/generate-tuition-pix';
import type { GetSchoolPlanInvoicePix } from '../../../app/use-cases/schools/get-school-plan-invoice-pix';
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
import { makeResolveSchoolContextMiddleware, type SchoolContextRequest } from '../middlewares/resolve-school-context';
import type { ListSchoolBankAccounts } from '../../../app/use-cases/schools/list-school-bank-accounts';
import type { CreateSchoolBankAccount } from '../../../app/use-cases/schools/create-school-bank-account';
import type { UpdateSchoolBankAccount } from '../../../app/use-cases/schools/update-school-bank-account';
import type { DeleteSchoolBankAccount } from '../../../app/use-cases/schools/delete-school-bank-account';
import type { ListSchoolNotifications } from '../../../app/use-cases/schools/list-school-notifications';
import type { SendClassPushNotification } from '../../../app/use-cases/schools/send-class-push-notification';
import type { RequestPhoneOtpChallenge } from '../../../app/use-cases/auth/request-phone-otp-challenge';
import type { VerifyPhoneOtpChallenge } from '../../../app/use-cases/auth/verify-phone-otp-challenge';
import type { ResetPassword } from '../../../app/use-cases/auth/reset-password';
import type { UpdateSchoolPassword } from '../../../app/use-cases/schools/update-school-password';
import type { GetStudentDirectoryEntry } from '../../../app/use-cases/students/get-student-directory-entry';
import { buildPasswordResetRoutes } from './schools/password-reset.routes';
import { buildDashboardRoutes } from './schools/dashboard.routes';
import { buildImagesRoutes } from './schools/images.routes';
import { z } from 'zod';
import { asyncHandler } from '../utils/async-handler';
import type { RequestSchoolActionOtp } from '../../../app/use-cases/schools/request-school-action-otp';
import type { VerifySchoolActionOtp } from '../../../app/use-cases/schools/verify-school-action-otp';
import { buildSecurityRoutes } from './schools/security.routes';
import type { GetSchoolNotificationPreferences } from '../../../app/use-cases/schools/get-school-notification-preferences';
import type { UpdateSchoolNotificationPreferences } from '../../../app/use-cases/schools/update-school-notification-preferences';
import type { ReadSchoolNotification } from '../../../app/use-cases/schools/read-school-notification';
import type { ReadAllSchoolNotifications } from '../../../app/use-cases/schools/read-all-school-notifications';
import { buildEnrollmentProgressRoutes } from './schools/enrollment-progress.routes';
import type { ListSchoolStudentLevels } from '../../../app/use-cases/schools/list-school-student-levels';
import type { CreateSchoolStudentLevel } from '../../../app/use-cases/schools/create-school-student-level';
import type { ListSchoolCertificateTemplates } from '../../../app/use-cases/schools/list-school-certificate-templates';
import type { CreateSchoolCertificateTemplate } from '../../../app/use-cases/schools/create-school-certificate-template';
import type { GetEnrollmentProgressOverview } from '../../../app/use-cases/schools/get-enrollment-progress-overview';
import type { RecordEnrollmentLevelPromotion } from '../../../app/use-cases/enrollments/record-enrollment-level-promotion';
import type { AppendEnrollmentTimelineEvent } from '../../../app/use-cases/enrollments/append-enrollment-timeline-event';
import type { IssueEnrollmentPromotionCertificate } from '../../../app/use-cases/enrollments/issue-enrollment-promotion-certificate';
import type { ListEnrollmentTimeline } from '../../../app/use-cases/enrollments/list-enrollment-timeline';
import type { UpdateSchoolStudentLevel } from '../../../app/use-cases/schools/update-school-student-level';
import type { DeleteSchoolStudentLevel } from '../../../app/use-cases/schools/delete-school-student-level';
import type { ReorderSchoolStudentLevels } from '../../../app/use-cases/schools/reorder-school-student-levels';
import type { ListEnrollmentLevelPromotions } from '../../../app/use-cases/enrollments/list-enrollment-level-promotions';

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
    unenrollStudentFromClass?: UnenrollStudentFromClass;
    listEnrollmentRequests?: ListEnrollmentRequests;
    authMiddleware?: RequestHandler;
    schoolsRepo?: SchoolRepository;
    createSchoolCharge?: CreateSchoolCharge;
    getSchoolFinancialSummary?: import('../../../app/use-cases/schools/get-school-financial-summary').GetSchoolFinancialSummary;
    listSchoolWithdrawals?: import('../../../app/use-cases/schools/list-school-withdrawals').ListSchoolWithdrawals;
    requestSchoolWithdrawal?: import('../../../app/use-cases/schools/request-school-withdrawal').RequestSchoolWithdrawal;
    getSchoolBalance?: import('../../../app/use-cases/schools/get-school-balance').GetSchoolBalance;
    schoolMarkChargePaid?: import('../../../app/use-cases/schools/school-mark-charge-paid').SchoolMarkChargePaid;
    schoolDeleteCharge?: import('../../../app/use-cases/schools/school-delete-charge').SchoolDeleteCharge;
    generateTuitionPix?: GenerateTuitionPix;
    getSchoolPlanInvoicePix?: GetSchoolPlanInvoicePix;
    listSchoolBankAccounts?: ListSchoolBankAccounts;
    createSchoolBankAccount?: CreateSchoolBankAccount;
    updateSchoolBankAccount?: UpdateSchoolBankAccount;
    deleteSchoolBankAccount?: DeleteSchoolBankAccount;
    requestSchoolPasswordPhoneOtp?: RequestPhoneOtpChallenge;
    verifySchoolPasswordPhoneOtp?: VerifyPhoneOtpChallenge;
    requestSchoolSignupPhoneOtp?: RequestPhoneOtpChallenge;
    verifySchoolSignupPhoneOtp?: VerifyPhoneOtpChallenge;
    resetPassword?: ResetPassword;
    validatePasswordResetToken?: import('../../../app/use-cases/auth/validate-password-reset-token').ValidatePasswordResetToken;
    updateSchoolPassword?: UpdateSchoolPassword;
    getStudentDirectoryEntry?: GetStudentDirectoryEntry;
    getSchoolStudentDetails?: import('../../../app/use-cases/schools/get-school-student-details').GetSchoolStudentDetails;
    listSchoolStudentPaidCharges?: import('../../../app/use-cases/schools/list-school-student-paid-charges').ListSchoolStudentPaidCharges;
    consolidateSchoolStudentFinancial?: import('../../../app/use-cases/schools/consolidate-school-student-financial').ConsolidateSchoolStudentFinancial;
    getSchoolDashboard?: import('../../../app/use-cases/schools/get-school-dashboard').GetSchoolDashboard;
    uploadSchoolImage?: import('../../../app/use-cases/schools/upload-school-image').UploadSchoolImage;
    listSchoolImages?: import('../../../app/use-cases/schools/list-school-images').ListSchoolImages;
    validateSchoolCoupon?: import('../../../app/use-cases/schools/validate-school-coupon').ValidateSchoolCoupon;
    listSchoolNotifications?: ListSchoolNotifications;
    sendClassPushNotification?: SendClassPushNotification;
    getSchoolNotificationPreferences?: GetSchoolNotificationPreferences;
    updateSchoolNotificationPreferences?: UpdateSchoolNotificationPreferences;
    readSchoolNotification?: ReadSchoolNotification;
    readAllSchoolNotifications?: ReadAllSchoolNotifications;
    getSchoolPendingDocuments?: import('../../../app/use-cases/schools/get-school-pending-documents').GetSchoolPendingDocuments;
    syncSchoolOnboardingDocuments?: import('../../../app/use-cases/schools/sync-school-onboarding-documents').SyncSchoolOnboardingDocuments;
    uploadSchoolOnboardingDocument?: import('../../../app/use-cases/admin/admin-upload-school-onboarding-document').AdminUploadSchoolOnboardingDocument;
    syncSchoolSubaccountStatus?: import('../../../app/use-cases/schools/sync-school-subaccount-status').SyncSchoolSubaccountStatus;
    resendSchoolAsaasBankAccount?: import('../../../app/use-cases/schools/resend-school-asaas-bank-account').ResendSchoolAsaasBankAccount;
    requestSchoolActionOtp?: RequestSchoolActionOtp;
    verifySchoolActionOtp?: VerifySchoolActionOtp;
    listSchoolStudentLevels?: ListSchoolStudentLevels;
    createSchoolStudentLevel?: CreateSchoolStudentLevel;
    listSchoolCertificateTemplates?: ListSchoolCertificateTemplates;
    createSchoolCertificateTemplate?: CreateSchoolCertificateTemplate;
    getEnrollmentProgressOverview?: GetEnrollmentProgressOverview;
    recordEnrollmentLevelPromotion?: RecordEnrollmentLevelPromotion;
    appendEnrollmentTimelineEvent?: AppendEnrollmentTimelineEvent;
    issueEnrollmentPromotionCertificate?: IssueEnrollmentPromotionCertificate;
    listEnrollmentTimeline?: ListEnrollmentTimeline;
    updateSchoolStudentLevel?: UpdateSchoolStudentLevel;
    deleteSchoolStudentLevel?: DeleteSchoolStudentLevel;
    reorderSchoolStudentLevels?: ReorderSchoolStudentLevels;
    listEnrollmentLevelPromotions?: ListEnrollmentLevelPromotions;
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
        listSubscriptionPlans: deps.listSubscriptionPlans,
        requestSchoolSignupPhoneOtp: deps.requestSchoolSignupPhoneOtp,
        verifySchoolSignupPhoneOtp: deps.verifySchoolSignupPhoneOtp
    }, optionalAuth));

    router.use(buildProfileRoutes({
        getSchoolProfile: deps.getSchoolProfile,
        updateSchool: deps.updateSchool
    }, guards));

    router.use(buildPlansRoutes({
        assignSchoolPlan: deps.assignSchoolPlan,
        getActiveSchoolPlan: deps.getActiveSchoolPlan,
        issueSchoolPlanInvoice: deps.issueSchoolPlanInvoice,
        listSchoolPlanInvoices: deps.listSchoolPlanInvoices,
        getSchoolPlanInvoicePix: deps.getSchoolPlanInvoicePix
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

    if (
        deps.createSchoolCharge ||
        deps.getSchoolFinancialSummary ||
        deps.listSchoolWithdrawals ||
        deps.requestSchoolWithdrawal ||
        deps.getSchoolBalance ||
        deps.schoolMarkChargePaid ||
        deps.schoolDeleteCharge ||
        deps.generateTuitionPix
    ) {
        router.use('/finance', buildFinanceRoutes({
            createSchoolCharge: deps.createSchoolCharge,
            getSchoolFinancialSummary: deps.getSchoolFinancialSummary,
            listSchoolWithdrawals: deps.listSchoolWithdrawals,
            requestSchoolWithdrawal: deps.requestSchoolWithdrawal,
            getSchoolBalance: deps.getSchoolBalance,
            schoolMarkChargePaid: deps.schoolMarkChargePaid,
            schoolDeleteCharge: deps.schoolDeleteCharge,
            generateTuitionPix: deps.generateTuitionPix
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
        unenrollStudentFromClass: deps.unenrollStudentFromClass,
        listEnrollmentRequests: deps.listEnrollmentRequests
    }, guards));

    router.use(buildSessionsRoutes({
        listClassSessions: deps.listClassSessions,
        cancelClassSession: deps.cancelClassSession
    }, guards));

    if (deps.getSchoolNotificationPreferences && deps.updateSchoolNotificationPreferences) {
        router.use('/notifications', buildNotificationsRoutes({
            listSchoolNotifications: deps.listSchoolNotifications,
            sendClassPushNotification: deps.sendClassPushNotification,
            getSchoolNotificationPreferences: deps.getSchoolNotificationPreferences,
            updateSchoolNotificationPreferences: deps.updateSchoolNotificationPreferences,
            readSchoolNotification: deps.readSchoolNotification,
            readAllSchoolNotifications: deps.readAllSchoolNotifications
        }, guards));
    }

    if (deps.requestSchoolActionOtp || deps.verifySchoolActionOtp) {
        router.use('/security', buildSecurityRoutes({
            requestSchoolActionOtp: deps.requestSchoolActionOtp,
            verifySchoolActionOtp: deps.verifySchoolActionOtp
        }, guards));
    }

    if (
        deps.listSchoolStudentLevels &&
        deps.createSchoolStudentLevel &&
        deps.listSchoolCertificateTemplates &&
        deps.createSchoolCertificateTemplate &&
        deps.getEnrollmentProgressOverview &&
        deps.recordEnrollmentLevelPromotion &&
        deps.appendEnrollmentTimelineEvent &&
        deps.issueEnrollmentPromotionCertificate &&
        deps.listEnrollmentTimeline &&
        deps.updateSchoolStudentLevel &&
        deps.deleteSchoolStudentLevel &&
        deps.reorderSchoolStudentLevels &&
        deps.listEnrollmentLevelPromotions
    ) {
        router.use(
            '/',
            buildEnrollmentProgressRoutes(
                {
                    listSchoolStudentLevels: deps.listSchoolStudentLevels,
                    createSchoolStudentLevel: deps.createSchoolStudentLevel,
                    updateSchoolStudentLevel: deps.updateSchoolStudentLevel,
                    deleteSchoolStudentLevel: deps.deleteSchoolStudentLevel,
                    reorderSchoolStudentLevels: deps.reorderSchoolStudentLevels,
                    listSchoolCertificateTemplates: deps.listSchoolCertificateTemplates,
                    createSchoolCertificateTemplate: deps.createSchoolCertificateTemplate,
                    getEnrollmentProgressOverview: deps.getEnrollmentProgressOverview,
                    recordEnrollmentLevelPromotion: deps.recordEnrollmentLevelPromotion,
                    appendEnrollmentTimelineEvent: deps.appendEnrollmentTimelineEvent,
                    issueEnrollmentPromotionCertificate: deps.issueEnrollmentPromotionCertificate,
                    listEnrollmentTimeline: deps.listEnrollmentTimeline,
                    listEnrollmentLevelPromotions: deps.listEnrollmentLevelPromotions
                },
                guards
            )
        );
    }

    if (deps.getSchoolPendingDocuments || deps.syncSchoolSubaccountStatus) {
        router.use(
            '/kyc',
            buildKycRoutes(
                {
                    getSchoolPendingDocuments: deps.getSchoolPendingDocuments,
                    syncSchoolOnboardingDocuments: deps.syncSchoolOnboardingDocuments,
                    uploadSchoolOnboardingDocument: deps.uploadSchoolOnboardingDocument,
                    syncSchoolSubaccountStatus: deps.syncSchoolSubaccountStatus,
                    resendSchoolAsaasBankAccount: deps.resendSchoolAsaasBankAccount
                },
                guards
            )
        );
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

        router.patch(
            '/password',
            requireAuth,
            requireSchoolPersona,
            resolveSchoolContext,
            asyncHandler(async (req, res) => {
                const data = updatePasswordSchema.parse(req.body);
                const ctxReq = req as SchoolContextRequest;
                const schoolId = ctxReq.schoolId;

                if (!schoolId) {
                    return res.status(403).json({ error: 'School context not found for user' });
                }

                await deps.updateSchoolPassword!.exec({
                    schoolId,
                    currentPassword: data.currentPassword,
                    newPassword: data.newPassword
                });

                res.status(204).send();
            })
        );
    }

    // Rotas públicas de reset de senha
    router.use('/password', buildPasswordResetRoutes({
        requestSchoolPasswordPhoneOtp: deps.requestSchoolPasswordPhoneOtp,
        verifySchoolPasswordPhoneOtp: deps.verifySchoolPasswordPhoneOtp,
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
