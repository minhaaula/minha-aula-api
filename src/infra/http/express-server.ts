import express from 'express';

export function makeServer(deps: any) {
    const app = express();
    app.use(express.json());
    app.use('/payments', deps.paymentsRouter(deps));
    app.get('/health', (_req, res) => res.json({ ok: true }));
    app.use((err: any, _req: any, res: any, _next: any) => {
        console.error(err);
        res.status(400).json({ error: err?.message ?? 'Bad Request' });
    });
    return app;
}
