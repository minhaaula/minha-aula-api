import express, { type RequestHandler, type Router } from 'express';
import swaggerUi from 'swagger-ui-express';
import { requestLogger } from './middlewares/request-logger';
import { loadOpenApiDocument } from './swagger/load-openapi';
import type { ModuleName } from '../../bootstrap/module-config';
import { AppError } from '../../shared/errors';

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
    // Routers prontos (montados pelos módulos)
    authRouter?: Router;
    adminRouter?: Router;
    paymentsRouter?: Router;
    studentsRouter?: Router;
    schoolsRouter?: Router;
    asaasWebhookRouter?: Router;
    dependentsRouter?: Router;
    enrollmentRequestsRouter?: Router;
    
    // Middleware e configuração
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

    // Montar routers apenas se existirem (já prontos pelos módulos)
    if (deps.authRouter) {
        app.use('/auth', deps.authRouter);
    }
    
    if (deps.adminRouter) {
        mount('/admin', deps.adminRouter, { skipAuth: true });
    }
    
    if (deps.paymentsRouter) {
        mount('/payments', deps.paymentsRouter, { skipAuth: true });
    }

    if (deps.studentsRouter) {
        mount('/students', deps.studentsRouter);
    }

    if (deps.schoolsRouter) {
        mount('/schools', deps.schoolsRouter, { skipAuth: true });
    }

    if (deps.asaasWebhookRouter) {
        mount('/integrations/asaas', deps.asaasWebhookRouter, { skipAuth: true });
    }

    if (deps.dependentsRouter) {
        mount('/dependents', deps.dependentsRouter);
    }

    if (deps.enrollmentRequestsRouter) {
        mount('/enrollment-requests', deps.enrollmentRequestsRouter);
    }
    app.use('/health', deps.healthRouter(deps));
    app.use((err: any, _req: any, res: any, _next: any) => {
        console.error(err);
        
        // Se for AppError, usar o formato padronizado
        if (err instanceof AppError) {
            const statusCode = getStatusCodeFromErrorCode(err.code);
            return res.status(statusCode).json({
                error: err.message,
                code: err.code,
                ...(err.details && { details: err.details })
            });
        }
        
        // Erros padrão
        res.status(400).json({ error: err?.message ?? 'Bad Request' });
    });

function getStatusCodeFromErrorCode(code: string): number {
    if (code.startsWith('VALIDATION') || code.includes('INVALID')) return 400;
    if (code.includes('NOT_FOUND')) return 404;
    if (code.includes('UNAUTHORIZED')) return 401;
    if (code.includes('FORBIDDEN') || code.includes('NOT_ALLOWED')) return 403;
    if (code.includes('ALREADY_EXISTS') || code.includes('CONFLICT')) return 409;
    if (code.includes('CONFIGURATION')) return 500;
    return 400;
}

    return app;
}
