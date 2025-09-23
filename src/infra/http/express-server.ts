import express from 'express';
import { requestLogger } from './middlewares/request-logger';

export function makeServer(deps: any) {
    const app = express();
    app.use(express.json());
    app.use(requestLogger);
    if (deps.authRouter) {
        app.use('/auth', deps.authRouter(deps));
    }
    app.use('/payments', deps.paymentsRouter(deps));
    app.use('/health', deps.healthRouter(deps));
    app.use((err: any, _req: any, res: any, _next: any) => {
        console.error(err);
        res.status(400).json({ error: err?.message ?? 'Bad Request' });
    });
    return app;
}
