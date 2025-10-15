import { ModuleBuildResult, ModuleSetupContext } from './types';
import { UserRepositoryAdapter } from '../../infra/db/typeorm/user-repository.adap';
import { DependentRepositoryAdapter } from '../../infra/db/typeorm/dependent-repository.adap';
import { SchoolRepositoryAdapter } from '../../infra/db/typeorm/school-repository.adap';
import { CourseRepositoryAdapter } from '../../infra/db/typeorm/course-repository.adap';
import { CourseClassRepositoryAdapter } from '../../infra/db/typeorm/course-class-repository.adap';
import { EnrollmentRepositoryAdapter } from '../../infra/db/typeorm/enrollment-repository.adap';
import { EnrollmentRequestRepositoryAdapter } from '../../infra/db/typeorm/enrollment-request-repository.adap';
import { AddDependent } from '../../app/use-cases/add-dependent';
import { CreateEnrollmentRequest } from '../../app/use-cases/create-enrollment-request';
import { ApproveEnrollmentRequest } from '../../app/use-cases/approve-enrollment-request';
import { dependentsRouter } from '../../infra/http/routes/dependents.routes';
import { enrollmentRequestsRouter } from '../../infra/http/routes/enrollment-requests.routes';
import { ListStudents } from '../../app/use-cases/list-students';
import { studentsRouter } from '../../infra/http/routes/students.routes';
import { ListSchools } from '../../app/use-cases/list-schools';
import { ListEnrollmentRequests } from '../../app/use-cases/list-enrollment-requests';
import { GetEnrollmentRequest } from '../../app/use-cases/get-enrollment-request';

export type StudentsModuleDeps = {
    usersRepo: UserRepositoryAdapter;
    dependentsRepo: DependentRepositoryAdapter;
    schoolsRepo: SchoolRepositoryAdapter;
    coursesRepo: CourseRepositoryAdapter;
    classesRepo: CourseClassRepositoryAdapter;
    enrollmentsRepo: EnrollmentRepositoryAdapter;
    enrollmentRequestsRepo: EnrollmentRequestRepositoryAdapter;
};

export function buildStudentsModule(deps: StudentsModuleDeps, _ctx: ModuleSetupContext): ModuleBuildResult {
    const addDependent = new AddDependent(deps.usersRepo, deps.dependentsRepo);
    const listStudents = new ListStudents(deps.usersRepo, deps.dependentsRepo, deps.classesRepo, deps.enrollmentsRepo);
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
    const approveEnrollmentRequest = new ApproveEnrollmentRequest(deps.enrollmentRequestsRepo, deps.enrollmentsRepo);
    const listEnrollmentRequests = new ListEnrollmentRequests(deps.enrollmentRequestsRepo);
    const getEnrollmentRequest = new GetEnrollmentRequest(deps.enrollmentRequestsRepo);

    return {
        deps: {
            studentsRouter,
            listStudents,
            dependentsRouter,
            addDependent,
            enrollmentRequestsRouter,
            createEnrollmentRequest,
            approveEnrollmentRequest,
            listEnrollmentRequests,
            getEnrollmentRequest,
            listSchools
        },
        docFiles: ['students.yaml', 'dependents.yaml', 'enrollment-requests.yaml', 'schools-public.yaml']
    };
}
