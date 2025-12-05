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
import { ListMyDependents } from '../../app/use-cases/list-my-dependents';
import { GetMyProfile } from '../../app/use-cases/get-my-profile';
import { ListMyEnrollmentRequests } from '../../app/use-cases/list-my-enrollment-requests';
import { UpdateStudentProfile } from '../../app/use-cases/update-student-profile';
import { ListSchoolCourses } from '../../app/use-cases/list-school-courses';
import { ListSchoolReviews } from '../../app/use-cases/list-school-reviews';
import { GetSchoolPublicDetails } from '../../app/use-cases/get-school-public-details';
import { CategoryRepositoryAdapter } from '../../infra/db/typeorm/category-repository.adapter';
import { SchoolReviewRepositoryAdapter } from '../../infra/db/typeorm/school-review-repository.adapter';

import { StorageProviderPort } from '../../ports/providers/storage-provider.port';

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
};

export function buildStudentsModule(deps: StudentsModuleDeps, _ctx: ModuleSetupContext): ModuleBuildResult {
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
    const listMyCourses = new ListMyCourses(deps.enrollmentsRepo, deps.coursesRepo, deps.schoolsRepo);
    const listAllCourses = deps.categoriesRepo
        ? new ListAllCourses(deps.coursesRepo, deps.categoriesRepo)
        : undefined;
    const listStudentPayments = new ListStudentPayments(deps.financialChargesRepo);
    const listSchools = new ListSchools(deps.schoolsRepo);
    const createEnrollmentRequest = new CreateEnrollmentRequest(
        deps.schoolsRepo,
        deps.coursesRepo,
        deps.classesRepo,
        deps.usersRepo,
        deps.dependentsRepo,
        deps.enrollmentsRepo,
        deps.enrollmentRequestsRepo
    );
    const approveEnrollmentRequest = new ApproveEnrollmentRequest(
        deps.enrollmentRequestsRepo,
        deps.enrollmentsRepo,
        deps.classesRepo,
        deps.financialChargesRepo
    );
    const issueEnrollmentFeeBoleto = new IssueEnrollmentFeeBoleto(
        deps.financialChargesRepo,
        deps.usersRepo,
        deps.paymentProvider
    );
    const listEnrollmentRequests = new ListEnrollmentRequests(deps.enrollmentRequestsRepo);
    const getEnrollmentRequest = new GetEnrollmentRequest(deps.enrollmentRequestsRepo);
    const listMyEnrollmentRequests = new ListMyEnrollmentRequests(deps.enrollmentRequestsRepo, deps.dependentsRepo);
    const listSchoolCourses = deps.categoriesRepo
        ? new ListSchoolCourses(deps.coursesRepo, deps.categoriesRepo)
        : undefined;
    const listSchoolReviews = deps.schoolReviewsRepo
        ? new ListSchoolReviews(deps.schoolReviewsRepo, deps.storageProvider)
        : undefined;
    const getSchoolPublicDetails = new GetSchoolPublicDetails(deps.schoolsRepo);

    // Montar routers prontos
    const studentsRouterInstance = studentsRouter({
        listStudents,
        getStudentDirectoryEntry,
        getMyProfile,
        updateStudentProfile,
        listMyCourses,
        listAllCourses,
        listStudentPayments,
        listMyEnrollmentRequests,
        listSchoolCourses,
        listSchoolReviews,
        approveEnrollmentRequest,
        getSchoolPublicDetails
    });

    const listMyDependents = new ListMyDependents(deps.dependentsRepo);
    
    const dependentsRouterInstance = dependentsRouter({
        addDependent,
        listMyDependents
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
