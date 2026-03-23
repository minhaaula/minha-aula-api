import express, { type RequestHandler, type Router } from 'express';
import swaggerUi from 'swagger-ui-express';
import { requestLogger } from './middlewares/request-logger';
import { defaultRateLimiter } from './middlewares/rate-limiter';
import { loadOpenApiDocument } from './swagger/load-openapi';
import type { ModuleName } from '../../bootstrap/module-config';
import { AppError, ErrorCode } from '../../shared/errors';

const SWAGGER_REALM = 'Swagger UI';

function parseTrustProxyEnv(): boolean | number | string {
    const raw = process.env.TRUST_PROXY?.trim();
    if (!raw) {
        return process.env.NODE_ENV === 'production' ? 1 : false;
    }

    const lowered = raw.toLowerCase();
    if (lowered === 'true') return true;
    if (lowered === 'false') return false;

    const asNumber = Number.parseInt(raw, 10);
    if (!Number.isNaN(asNumber)) return asNumber;

    return raw;
}

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
    landingRouter?: Router;
    
    // Middleware e configuração
    authMiddleware?: RequestHandler;
    healthRouter: (deps: any) => Router;
    activeModules?: ModuleName[];
    openapiFiles?: string[];
}

export function makeServer(deps: AppDependencies & Record<string, any>) {
    const app = express();
    app.set('trust proxy', parseTrustProxyEnv());
    
    // Helmet para headers de segurança HTTP
    const helmet = require('helmet');
    app.use(helmet({
        contentSecurityPolicy: {
            directives: {
                defaultSrc: ["'self'"],
                styleSrc: ["'self'", "'unsafe-inline'"], // Necessário para Swagger UI
                scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"], // Necessário para Swagger UI
                imgSrc: ["'self'", "data:", "https:"],
            },
        },
        crossOriginEmbedderPolicy: false, // Desabilitado para compatibilidade com Swagger
    }));
    
    app.use(express.json());

    // CORS antes do rate limiter: respostas 429 (e qualquer outra) devem incluir
    // Access-Control-Allow-Origin para que o cliente cross-origin receba o status e a mensagem.
    const corsOrigin = process.env.CORS_ORIGIN || '*';
    const allowedOrigins = corsOrigin === '*' ? ['*'] : corsOrigin.split(',').map(o => o.trim());

    app.use((req, res, next) => {
        const origin = req.headers.origin;
        if (allowedOrigins.includes('*') || (origin && allowedOrigins.includes(origin))) {
            res.header('Access-Control-Allow-Origin', allowedOrigins.includes('*') ? '*' : origin || '*');
        }
        res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
        res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept');
        res.header('Access-Control-Allow-Credentials', 'true');
        if (req.method === 'OPTIONS') {
            return res.sendStatus(204);
        }
        next();
    });

    // Rate limit global (proteção contra abuso e DDoS leve)
    app.use(defaultRateLimiter);

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
        console.log('✓ Swagger/OpenAPI documentação carregada com sucesso');
    } catch (err) {
        console.error('✗ Swagger não pôde ser carregado:', err);
        console.error('  A rota /docs não estará disponível.');
        if (err instanceof Error) {
            console.error('  Erro:', err.message);
        }
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
        console.log('✓ Rota /docs montada com sucesso');
    } else {
        console.warn('⚠ Rota /docs não foi montada (documentação OpenAPI não disponível)');
    }

    // Portal Docusaurus desabilitado por padrão neste ambiente.
    console.log('ℹ Rota /portal desabilitada');

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

    if (deps.landingRouter) {
        mount('/landing', deps.landingRouter, { skipAuth: true });
    }

    app.use('/health', deps.healthRouter(deps));
    app.use((err: any, _req: any, res: any, _next: any) => {
        console.error(err);
        
        // Se for AppError, usar o formato padronizado
        if (err instanceof AppError) {
            const statusCode = getStatusCodeFromErrorCode(err.code);
            const errorMessage = typeof err.details?.message === 'string'
                ? err.details.message
                : err.message;
            return res.status(statusCode).json({
                error: errorMessage,
                code: err.code,
                ...(err.details && { details: err.details })
            });
        }
        
        // Tratar erros de duplicação do banco de dados
        if (err?.code === 'ER_DUP_ENTRY' || (err?.message && err.message.includes('Duplicate entry'))) {
            const errorMessage = err.message || '';
            
            // Erro de CPF duplicado em dependentes
            if (errorMessage.includes('idx_dependents_cpf')) {
                const cpfMatch = errorMessage.match(/Duplicate entry '([^']+)'/);
                const cpf = cpfMatch ? cpfMatch[1] : null;
                return res.status(409).json({
                    error: 'CPF já cadastrado',
                    code: ErrorCode.CPF_ALREADY_REGISTERED,
                    ...(cpf && { details: { cpf } })
                });
            }
            
            // Erro genérico de duplicação
            return res.status(409).json({
                error: 'Recurso já existe',
                code: ErrorCode.ALREADY_EXISTS
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
