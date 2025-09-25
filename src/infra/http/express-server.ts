import express from 'express';
import swaggerUi from 'swagger-ui-express';
import { requestLogger } from './middlewares/request-logger';
import { loadOpenApiDocument } from './swagger/load-openapi';

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
        app.use('/docs', swaggerUi.serve, swaggerUi.setup(openApiDocument));
        app.get('/docs/openapi.json', (_req, res) => {
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
