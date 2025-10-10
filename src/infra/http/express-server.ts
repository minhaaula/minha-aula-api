import express, { type RequestHandler, type Router } from 'express';
import swaggerUi from 'swagger-ui-express';
import { requestLogger } from './middlewares/request-logger';
import { loadOpenApiDocument } from './swagger/load-openapi';
import type { ModuleName } from '../../bootstrap/module-config';

const SWAGGER_REALM = 'Swagger UI';

const sendSwaggerUnauthorized = (res: express.Response) => {
    res.setHeader('WWW-Authenticate', `Basic realm="${SWAGGER_REALM}"`);
    res.status(401).send('Authentication required');
};

function makeSwaggerAuthMiddleware(): RequestHandler[] {
    if (process.env.NODE_ENV !== 'production') {
        return [];
    }

    const username = process.env.SWAGGER_USERNAME;
    const password = process.env.SWAGGER_PASSWORD;

    if (!username || !password) {
        console.warn('Swagger basic auth is enabled for production but SWAGGER_USERNAME or SWAGGER_PASSWORD is not set.');
        return [];
    }

    const authMiddleware: RequestHandler = (req, res, next) => {
        const header = req.headers.authorization;
        if (!header || !header.startsWith('Basic ')) {
            return sendSwaggerUnauthorized(res);
        }

        const token = header.slice('Basic '.length).trim();
        let decoded: string;

        try {
            decoded = Buffer.from(token, 'base64').toString('utf8');
        } catch {
            return sendSwaggerUnauthorized(res);
        }

        const separatorIndex = decoded.indexOf(':');
        if (separatorIndex === -1) {
            return sendSwaggerUnauthorized(res);
        }

        const providedUsername = decoded.slice(0, separatorIndex);
        const providedPassword = decoded.slice(separatorIndex + 1);

        if (providedUsername === username && providedPassword === password) {
            return next();
        }

        return sendSwaggerUnauthorized(res);
    };

    return [authMiddleware];
}

type MountOptions = { skipAuth?: boolean };

interface AppDependencies {
    authRouter?: (deps: any) => Router;
    registerUser?: any;
    loginUser?: any;
    updateUserPassword?: any;
    paymentsRouter?: (deps: any) => Router;
    createPayment?: any;
    capturePayment?: any;
    issueBoleto?: any;
    studentsRouter?: (deps: any) => Router;
    listStudents?: any;
    schoolsRouter?: (deps: any) => Router;
    createSchool?: any;
    listSchools?: any;
    createCourse?: any;
    createCourseClass?: any;
    schoolsRepo?: any;
    scheduleClassSession?: any;
    listClassSessions?: any;
    cancelClassSession?: any;
    loginSchool?: any;
    getActiveSchoolPlan?: any;
    listSubscriptionPlans?: any;
    assignSchoolPlan?: any;
    listCategories?: any;
    listSchoolCourses?: any;
    getSchoolProfile?: any;
    getSchoolCourse?: any;
    listCourseClasses?: any;
    getCourseClass?: any;
    updateSchool?: any;
    dependentsRouter?: (deps: any) => Router;
    addDependent?: any;
    enrollmentRequestsRouter?: (deps: any) => Router;
    createEnrollmentRequest?: any;
    approveEnrollmentRequest?: any;
    listEnrollmentRequests?: any;
    getEnrollmentRequest?: any;
    authMiddleware?: RequestHandler;
    healthRouter: (deps: any) => Router;
    activeModules?: ModuleName[];
    openapiFiles?: string[];
}

export function makeServer(deps: AppDependencies & Record<string, any>) {
    const app = express();
    app.use(express.json());
    app.use((req, res, next) => {
        res.header('Access-Control-Allow-Origin', '*');
        res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
        res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept');
        if (req.method === 'OPTIONS') {
            return res.sendStatus(204);
        }
        next();
    });
    app.use(requestLogger);

    const mount = (path: string, router: Router, options?: MountOptions) => {
        if (deps.authMiddleware && !options?.skipAuth) {
            app.use(path, deps.authMiddleware, router);
        } else {
            app.use(path, router);
        }
    };

    let openApiDocument: unknown;
    try {
        openApiDocument = loadOpenApiDocument({
            includeFiles: deps.openapiFiles,
            modules: deps.activeModules
        });
    } catch (err) {
        console.warn('Swagger não pôde ser carregado:', err);
    }

    if (openApiDocument) {
        const swaggerAuth = makeSwaggerAuthMiddleware();
        const swaggerHandler = swaggerUi.setup(undefined, {
            swaggerOptions: { spec: openApiDocument },
            customSiteTitle: 'Minha Aula API Docs'
        });
        app.use('/docs', ...swaggerAuth, swaggerUi.serve, swaggerHandler);
        app.get('/docs/openapi.json', ...swaggerAuth, (_req, res) => {
            res.json(openApiDocument);
        });
    }

    if (deps.authRouter && deps.registerUser && deps.loginUser && deps.updateUserPassword) {
        app.use('/auth', deps.authRouter({
            registerUser: deps.registerUser,
            loginUser: deps.loginUser,
            updateUserPassword: deps.updateUserPassword,
            authMiddleware: deps.authMiddleware
        }));
    }
    if (deps.paymentsRouter && deps.createPayment && deps.capturePayment) {
        const paymentsRoutes = deps.paymentsRouter({
            createPayment: deps.createPayment,
            capturePayment: deps.capturePayment,
            issueBoleto: deps.issueBoleto
        });
        mount('/payments', paymentsRoutes, { skipAuth: true });
    }

    if (deps.studentsRouter && deps.listStudents) {
        const router = deps.studentsRouter({
            listStudents: deps.listStudents
        });
        mount('/students', router);
    }

    if (deps.schoolsRouter && deps.createSchool && deps.createCourse && deps.createCourseClass) {
        const router = deps.schoolsRouter({
            createSchool: deps.createSchool,
            createCourse: deps.createCourse,
            createCourseClass: deps.createCourseClass,
            getSchoolProfile: deps.getSchoolProfile,
            updateSchool: deps.updateSchool,
            listSchoolCourses: deps.listSchoolCourses,
            getSchoolCourse: deps.getSchoolCourse,
            listCourseClasses: deps.listCourseClasses,
            getCourseClass: deps.getCourseClass,
            scheduleClassSession: deps.scheduleClassSession,
            listClassSessions: deps.listClassSessions,
            cancelClassSession: deps.cancelClassSession,
            loginSchool: deps.loginSchool,
            getActiveSchoolPlan: deps.getActiveSchoolPlan,
            listSubscriptionPlans: deps.listSubscriptionPlans,
            assignSchoolPlan: deps.assignSchoolPlan,
            listCategories: deps.listCategories,
            authMiddleware: deps.authMiddleware,
            schoolsRepo: deps.schoolsRepo
        });
        mount('/schools', router, { skipAuth: true });
    } else if (deps.listSchools) {
        const router = express.Router();
        router.get('/', async (_req, res, next) => {
            try {
                const schools = await deps.listSchools.exec();
                res.json({ schools });
            } catch (err) {
                next(err);
            }
        });
        mount('/schools', router, { skipAuth: true });
    }

    if (deps.dependentsRouter && deps.addDependent) {
        const router = deps.dependentsRouter({ addDependent: deps.addDependent });
        mount('/dependents', router);
    }

    if (
        deps.enrollmentRequestsRouter &&
        deps.createEnrollmentRequest &&
        deps.approveEnrollmentRequest &&
        deps.listEnrollmentRequests &&
        deps.getEnrollmentRequest
    ) {
        const router = deps.enrollmentRequestsRouter({
            createEnrollmentRequest: deps.createEnrollmentRequest,
            approveEnrollmentRequest: deps.approveEnrollmentRequest,
            listEnrollmentRequests: deps.listEnrollmentRequests,
            getEnrollmentRequest: deps.getEnrollmentRequest
        });
        mount('/enrollment-requests', router);
    }
    app.use('/health', deps.healthRouter(deps));
    app.use((err: any, _req: any, res: any, _next: any) => {
        console.error(err);
        res.status(400).json({ error: err?.message ?? 'Bad Request' });
    });
    return app;
}
