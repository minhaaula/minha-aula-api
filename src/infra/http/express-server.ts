import express, { type RequestHandler } from 'express';
import swaggerUi from 'swagger-ui-express';
import { requestLogger } from './middlewares/request-logger';
import { loadOpenApiDocument } from './swagger/load-openapi';

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

export function makeServer(deps: any) {
    const app = express();
    app.use(express.json());
    app.use(requestLogger);

    let openApiDocument: unknown;
    try {
        openApiDocument = loadOpenApiDocument();
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

    if (deps.authRouter) {
        app.use('/auth', deps.authRouter(deps));
    }
    const paymentsRoutes = deps.paymentsRouter(deps);
    if (deps.authMiddleware) {
        app.use('/payments', deps.authMiddleware, paymentsRoutes);
    } else {
        app.use('/payments', paymentsRoutes);
    }
    app.use('/health', deps.healthRouter(deps));
    app.use((err: any, _req: any, res: any, _next: any) => {
        console.error(err);
        res.status(400).json({ error: err?.message ?? 'Bad Request' });
    });
    return app;
}
