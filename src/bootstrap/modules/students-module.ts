import { ModuleBuildResult, ModuleSetupContext } from './types';
import { UserRepositoryAdapter } from '../../infra/db/typeorm/user-repository.adapter';
import { DependentRepositoryAdapter } from '../../infra/db/typeorm/dependent-repository.adapter';
import { SchoolRepositoryAdapter } from '../../infra/db/typeorm/school-repository';
import { CourseRepositoryAdapter } from '../../infra/db/typeorm/course-repository';
import { CourseClassRepositoryAdapter } from '../../infra/db/typeorm/course-class-repository.adapter';
import { EnrollmentRepositoryAdapter } from '../../infra/db/typeorm/enrollment-repository';
import { EnrollmentRequestRepositoryAdapter } from '../../infra/db/typeorm/enrollment-request-repository.adapter';
import { SchoolFinancialChargeRepositoryAdapter } from '../../infra/db/typeorm/school-financial-charge-repository.adapter';
import { AddDependent } from '../../app/use-cases/add-dependent';
import { CreateEnrollmentRequest } from '../../app/use-cases/create-enrollment-request';
import { ApproveEnrollmentRequest } from '../../app/use-cases/approve-enrollment-request';
import { RejectEnrollmentRequest } from '../../app/use-cases/reject-enrollment-request';
import { IssueEnrollmentFeeBoleto } from '../../app/use-cases/issue-enrollment-fee-boleto';
import { dependentsRouter } from '../../infra/http/routes/dependents.routes';
import { enrollmentRequestsRouter } from '../../infra/http/routes/enrollment-requests.routes';
import { ListStudents } from '../../app/use-cases/list-students';
import { studentsRouter } from '../../infra/http/routes/students.routes';
import { ListSchools } from '../../app/use-cases/list-schools';
import { ListEnrollmentRequests } from '../../app/use-cases/list-enrollment-requests';
import { GetEnrollmentRequest } from '../../app/use-cases/get-enrollment-request';
import { PaymentProviderPort } from '../../ports/providers/payment-provider.port';
import { GetStudentDirectoryEntry } from '../../app/use-cases/get-student-directory-entry';
import { ListMyCourses } from '../../app/use-cases/list-my-courses';
import { ListAllCourses } from '../../app/use-cases/list-all-courses';
import { ListStudentPayments } from '../../app/use-cases/list-student-payments';
import { GetStudentPaymentDetails } from '../../app/use-cases/get-student-payment-details';
import { ListMyDependents } from '../../app/use-cases/list-my-dependents';
import { DeleteDependent } from '../../app/use-cases/delete-dependent';
import { UpdateDependent } from '../../app/use-cases/update-dependent';
import { GetMyProfile } from '../../app/use-cases/get-my-profile';
import { ListMyEnrollmentRequests } from '../../app/use-cases/list-my-enrollment-requests';
import { UpdateStudentProfile } from '../../app/use-cases/update-student-profile';
import { DeactivateStudentAccount } from '../../app/use-cases/deactivate-student-account';
import { ListSchoolCourses } from '../../app/use-cases/list-school-courses';
import { ListSchoolReviews } from '../../app/use-cases/list-school-reviews';
import { CreateSchoolReview } from '../../app/use-cases/create-school-review';
import { GetSchoolPublicDetails } from '../../app/use-cases/get-school-public-details';
import { GenerateTuitionPix } from '../../app/use-cases/generate-tuition-pix';
import { CategoryRepositoryAdapter } from '../../infra/db/typeorm/category-repository.adapter';
import { SchoolReviewRepositoryAdapter } from '../../infra/db/typeorm/school-review-repository.adapter';
import { NotificationRepositoryAdapter } from '../../infra/db/typeorm/notification-repository.adapter';
import { ListStudentNotifications } from '../../app/use-cases/list-student-notifications';
import { ReadAllNotifications } from '../../app/use-cases/read-all-notifications';
import { ReadStudentNotification } from '../../app/use-cases/read-student-notification';
import { PushTokenRepositoryAdapter } from '../../infra/db/typeorm/push-token-repository.adapter';
import { RegisterPushToken } from '../../app/use-cases/register-push-token';
import { UnregisterPushToken } from '../../app/use-cases/unregister-push-token';

import { StorageProviderPort } from '../../ports/providers/storage-provider.port';
import { SchoolImageRepositoryAdapter } from '../../infra/db/typeorm/school-image-repository.adapter';
import { OutboxRepository } from '../../ports/repositories/outbox.repo';
import { NotifyStudentUser } from '../../app/use-cases/notify-student-user';

export type StudentsModuleDeps = {
    usersRepo: UserRepositoryAdapter;
    dependentsRepo: DependentRepositoryAdapter;
    schoolsRepo: SchoolRepositoryAdapter;
    coursesRepo: CourseRepositoryAdapter;
    classesRepo: CourseClassRepositoryAdapter;
    enrollmentsRepo: EnrollmentRepositoryAdapter;
    enrollmentRequestsRepo: EnrollmentRequestRepositoryAdapter;
    financialChargesRepo: SchoolFinancialChargeRepositoryAdapter;
    paymentProvider: PaymentProviderPort;
    categoriesRepo?: CategoryRepositoryAdapter;
    schoolReviewsRepo?: SchoolReviewRepositoryAdapter;
    storageProvider?: StorageProviderPort;
    notificationsRepo?: NotificationRepositoryAdapter;
    pushTokensRepo?: PushTokenRepositoryAdapter;
    outbox?: OutboxRepository;
    frontendBaseUrl?: string;
};

export function buildStudentsModule(deps: StudentsModuleDeps, _ctx: ModuleSetupContext): ModuleBuildResult {
    const notifyStudent =
        deps.notificationsRepo && deps.outbox
            ? new NotifyStudentUser(deps.notificationsRepo, deps.outbox, deps.schoolsRepo)
            : undefined;

    const addDependent = new AddDependent(deps.usersRepo, deps.dependentsRepo);
    const listStudents = new ListStudents(
        deps.usersRepo,
        deps.dependentsRepo,
        deps.coursesRepo,
        deps.classesRepo,
        deps.enrollmentsRepo
    );
    const getStudentDirectoryEntry = new GetStudentDirectoryEntry(deps.usersRepo, deps.dependentsRepo);
    const getMyProfile = new GetMyProfile(deps.usersRepo, deps.dependentsRepo);
    const updateStudentProfile = new UpdateStudentProfile(deps.usersRepo);
    const deactivateStudentAccount = new DeactivateStudentAccount(deps.usersRepo);
    const schoolImagesRepo = new SchoolImageRepositoryAdapter();
    const listMyCourses = new ListMyCourses(deps.enrollmentsRepo, deps.coursesRepo, deps.schoolsRepo, schoolImagesRepo, deps.storageProvider);
    const listAllCourses = deps.categoriesRepo
        ? new ListAllCourses(deps.coursesRepo, deps.categoriesRepo, schoolImagesRepo, deps.storageProvider, deps.schoolReviewsRepo)
        : undefined;
    const listStudentPayments = new ListStudentPayments(deps.financialChargesRepo, schoolImagesRepo, deps.storageProvider);
    const getStudentPaymentDetails = new GetStudentPaymentDetails(
        deps.financialChargesRepo,
        deps.usersRepo,
        deps.dependentsRepo,
        deps.coursesRepo,
        deps.classesRepo
    );
    const listSchools = new ListSchools(deps.schoolsRepo);
    const createEnrollmentRequest = new CreateEnrollmentRequest(
        deps.schoolsRepo,
        deps.coursesRepo,
        deps.classesRepo,
        deps.usersRepo,
        deps.dependentsRepo,
        deps.enrollmentsRepo,
        deps.enrollmentRequestsRepo,
        notifyStudent,
        deps.outbox,
        deps.frontendBaseUrl
    );
    const issueEnrollmentFeeBoleto = new IssueEnrollmentFeeBoleto(
        deps.financialChargesRepo,
        deps.usersRepo,
        deps.schoolsRepo,
        deps.paymentProvider
    );
    const generateTuitionPix = new GenerateTuitionPix(
        deps.financialChargesRepo,
        deps.usersRepo,
        deps.schoolsRepo,
        deps.coursesRepo,
        deps.paymentProvider,
        schoolImagesRepo,
        deps.storageProvider
    );
    const approveEnrollmentRequest = new ApproveEnrollmentRequest(
        deps.enrollmentRequestsRepo,
        deps.enrollmentsRepo,
        deps.classesRepo,
        deps.coursesRepo,
        deps.financialChargesRepo,
        issueEnrollmentFeeBoleto,
        generateTuitionPix,
        deps.usersRepo,
        deps.schoolsRepo,
        deps.dependentsRepo,
        deps.outbox,
        notifyStudent,
        deps.frontendBaseUrl
    );
    const rejectEnrollmentRequest = new RejectEnrollmentRequest(
        deps.enrollmentRequestsRepo,
        deps.usersRepo,
        deps.schoolsRepo,
        deps.coursesRepo,
        deps.classesRepo,
        deps.dependentsRepo,
        deps.outbox,
        notifyStudent,
        deps.frontendBaseUrl
    );
    const listEnrollmentRequests = new ListEnrollmentRequests(deps.enrollmentRequestsRepo);
    const getEnrollmentRequest = new GetEnrollmentRequest(deps.enrollmentRequestsRepo);
    const listMyEnrollmentRequests = new ListMyEnrollmentRequests(
        deps.enrollmentRequestsRepo,
        deps.dependentsRepo,
        schoolImagesRepo,
        deps.storageProvider
    );
    const listSchoolCourses = deps.categoriesRepo
        ? new ListSchoolCourses(deps.coursesRepo, deps.categoriesRepo)
        : undefined;
    const listSchoolReviews = deps.schoolReviewsRepo
        ? new ListSchoolReviews(deps.schoolReviewsRepo, deps.storageProvider)
        : undefined;
    const createSchoolReview = deps.schoolReviewsRepo && deps.enrollmentsRepo
        ? new CreateSchoolReview(deps.schoolsRepo, deps.enrollmentsRepo, deps.schoolReviewsRepo)
        : undefined;
    const getSchoolPublicDetails = new GetSchoolPublicDetails(
        deps.schoolsRepo,
        schoolImagesRepo,
        deps.storageProvider,
        deps.enrollmentsRepo,
        deps.schoolReviewsRepo
    );
    const listStudentNotifications = deps.notificationsRepo
        ? new ListStudentNotifications(deps.notificationsRepo)
        : undefined;
    const readAllNotifications = deps.notificationsRepo
        ? new ReadAllNotifications(deps.notificationsRepo)
        : undefined;
    const readStudentNotification = deps.notificationsRepo
        ? new ReadStudentNotification(deps.notificationsRepo)
        : undefined;
    const registerPushToken = deps.pushTokensRepo
        ? new RegisterPushToken(deps.usersRepo, deps.pushTokensRepo)
        : undefined;
    const unregisterPushToken = deps.pushTokensRepo
        ? new UnregisterPushToken(deps.pushTokensRepo)
        : undefined;

    const studentsRouterInstance = studentsRouter({
        listStudents,
        getStudentDirectoryEntry,
        getMyProfile,
        updateStudentProfile,
        deactivateStudentAccount,
        listMyCourses,
        listAllCourses,
        listStudentPayments,
        getStudentPaymentDetails,
        listMyEnrollmentRequests,
        listSchoolCourses,
        listSchoolReviews,
        createSchoolReview,
        approveEnrollmentRequest,
        rejectEnrollmentRequest,
        getSchoolPublicDetails,
        generateTuitionPix,
        listStudentNotifications,
        readAllNotifications,
        readStudentNotification,
        registerPushToken,
        unregisterPushToken
    });

    const listMyDependents = new ListMyDependents(deps.dependentsRepo);
    const deleteDependent = new DeleteDependent(
        deps.dependentsRepo,
        deps.enrollmentsRepo,
        deps.enrollmentRequestsRepo
    );
    const updateDependent = new UpdateDependent(deps.dependentsRepo);
    
    const dependentsRouterInstance = dependentsRouter({
        addDependent,
        listMyDependents,
        deleteDependent,
        updateDependent
    });

    const enrollmentRequestsRouterInstance = enrollmentRequestsRouter({
        createEnrollmentRequest,
        approveEnrollmentRequest,
        listEnrollmentRequests,
        getEnrollmentRequest,
        issueEnrollmentFeeBoleto
    });

    return {
        deps: {
            studentsRouter: studentsRouterInstance,
            dependentsRouter: dependentsRouterInstance,
            enrollmentRequestsRouter: enrollmentRequestsRouterInstance
        },
        docFiles: ['students.yaml', 'dependents.yaml', 'enrollment-requests.yaml', 'schools-public.yaml']
    };
}
