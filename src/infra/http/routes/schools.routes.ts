import { Router, type RequestHandler } from 'express';
import type { CreateSchool } from '../../../app/use-cases/create-school';
import type { CreateCourse } from '../../../app/use-cases/create-course';
import type { CreateCourseClass } from '../../../app/use-cases/create-course-class';
import type { ScheduleClassSession } from '../../../app/use-cases/schedule-class-session';
import type { ListClassSessions } from '../../../app/use-cases/list-class-sessions';
import type { CancelClassSession } from '../../../app/use-cases/cancel-class-session';
import type { LoginSchool } from '../../../app/use-cases/login-school';
import type { GetActiveSchoolPlan } from '../../../app/use-cases/get-active-school-plan';
import type { ListSubscriptionPlans } from '../../../app/use-cases/list-subscription-plans';
import type { AssignSchoolPlan } from '../../../app/use-cases/assign-school-plan';
import type { ListCategories } from '../../../app/use-cases/list-categories';
import type { ListSchoolCourses } from '../../../app/use-cases/list-school-courses';
import type { GetSchoolCourse } from '../../../app/use-cases/get-school-course';
import type { ListCourseClasses } from '../../../app/use-cases/list-course-classes';
import type { GetCourseClass } from '../../../app/use-cases/get-course-class';
import type { GetSchoolProfile } from '../../../app/use-cases/get-school-profile';
import type { UpdateSchool } from '../../../app/use-cases/update-school';
import type { UpdateCourse } from '../../../app/use-cases/update-course';
import { requirePersona } from '../middlewares/require-persona';
import { UserPersonaEnum } from '../../../domain/value-objects/user-persona';
import type { SchoolRepository } from '../../../ports/repositories/school.repo';
import { buildPublicSchoolRoutes } from './schools/public.routes';
import { buildProfileRoutes } from './schools/profile.routes';
import { buildPlansRoutes } from './schools/plans.routes';
import { buildCoursesRoutes } from './schools/courses.routes';
import { buildSessionsRoutes } from './schools/sessions.routes';
import type { SchoolRouteGuards } from './schools/guards';
import { makeResolveSchoolContextMiddleware } from '../middlewares/resolve-school-context';

export type SchoolsRouterDeps = {
    createSchool: CreateSchool;
    createCourse: CreateCourse;
    createCourseClass: CreateCourseClass;
    scheduleClassSession: ScheduleClassSession;
    listClassSessions: ListClassSessions;
    cancelClassSession: CancelClassSession;
    loginSchool?: LoginSchool;
    getActiveSchoolPlan?: GetActiveSchoolPlan;
    listSubscriptionPlans?: ListSubscriptionPlans;
    assignSchoolPlan?: AssignSchoolPlan;
    listCategories?: ListCategories;
    listSchoolCourses?: ListSchoolCourses;
    getSchoolCourse?: GetSchoolCourse;
    updateCourse?: UpdateCourse;
    listCourseClasses?: ListCourseClasses;
    getCourseClass?: GetCourseClass;
    getSchoolProfile?: GetSchoolProfile;
    updateSchool?: UpdateSchool;
    authMiddleware?: RequestHandler;
    schoolsRepo?: SchoolRepository;
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
        getActiveSchoolPlan: deps.getActiveSchoolPlan
    }, guards));

    router.use('/courses', buildCoursesRoutes({
        createCourse: deps.createCourse,
        updateCourse: deps.updateCourse,
        listSchoolCourses: deps.listSchoolCourses,
        getSchoolCourse: deps.getSchoolCourse,
        createCourseClass: deps.createCourseClass,
        listCourseClasses: deps.listCourseClasses,
        getCourseClass: deps.getCourseClass,
        scheduleClassSession: deps.scheduleClassSession,
        listClassSessions: deps.listClassSessions
    }, guards));

    router.use(buildSessionsRoutes({
        listClassSessions: deps.listClassSessions,
        cancelClassSession: deps.cancelClassSession
    }, guards));

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
