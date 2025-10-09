import { ModuleBuildResult, ModuleSetupContext } from './types';
import { SchoolRepositoryAdapter } from '../../infra/db/typeorm/school-repository.adap';
import { CourseRepositoryAdapter } from '../../infra/db/typeorm/course-repository.adap';
import { CourseClassRepositoryAdapter } from '../../infra/db/typeorm/course-class-repository.adap';
import { UserRepositoryAdapter } from '../../infra/db/typeorm/user-repository.adap';
import { DependentRepositoryAdapter } from '../../infra/db/typeorm/dependent-repository.adap';
import { CreateSchool } from '../../app/use-cases/create-school';
import { CreateCourse } from '../../app/use-cases/create-course';
import { CreateCourseClass } from '../../app/use-cases/create-course-class';
import { schoolsRouter } from '../../infra/http/routes/schools.routes';
import { ListStudents } from '../../app/use-cases/list-students';
import { studentsRouter } from '../../infra/http/routes/students.routes';
import { ClassSessionRepositoryAdapter } from '../../infra/db/typeorm/class-session-repository.adap';
import { ScheduleClassSession } from '../../app/use-cases/schedule-class-session';
import { ListClassSessions } from '../../app/use-cases/list-class-sessions';
import { CancelClassSession } from '../../app/use-cases/cancel-class-session';
import { PasswordHasherPort } from '../../ports/providers/password-hasher.port';
import { TokenProviderPort } from '../../ports/providers/token-provider.port';
import { LoginSchool } from '../../app/use-cases/login-school';

export type SchoolsModuleDeps = {
    schoolsRepo: SchoolRepositoryAdapter;
    coursesRepo: CourseRepositoryAdapter;
    classesRepo: CourseClassRepositoryAdapter;
    usersRepo: UserRepositoryAdapter;
    dependentsRepo: DependentRepositoryAdapter;
    classSessionsRepo: ClassSessionRepositoryAdapter;
    passwordHasher: PasswordHasherPort;
    tokenProvider: TokenProviderPort;
    tokenTtl: number;
};

export function buildSchoolsModule(deps: SchoolsModuleDeps, _ctx: ModuleSetupContext): ModuleBuildResult {
    const createSchool = new CreateSchool(deps.schoolsRepo, deps.passwordHasher);
    const createCourse = new CreateCourse(deps.schoolsRepo, deps.coursesRepo);
    const createCourseClass = new CreateCourseClass(deps.coursesRepo, deps.classesRepo);
    const listStudents = new ListStudents(deps.usersRepo, deps.dependentsRepo);
    const scheduleClassSession = new ScheduleClassSession(deps.classSessionsRepo, deps.classesRepo, deps.coursesRepo);
    const listClassSessions = new ListClassSessions(deps.classSessionsRepo, deps.classesRepo, deps.coursesRepo);
    const cancelClassSession = new CancelClassSession(deps.classSessionsRepo);
    const loginSchool = new LoginSchool(deps.schoolsRepo, deps.passwordHasher, deps.tokenProvider, deps.tokenTtl);

    return {
        deps: {
            schoolsRouter,
            createSchool,
            createCourse,
            createCourseClass,
            studentsRouter,
            listStudents,
            scheduleClassSession,
            listClassSessions,
            cancelClassSession,
            schoolsRepo: deps.schoolsRepo,
            loginSchool
        },
        docFiles: ['schools.yaml', 'students.yaml']
    };
}
