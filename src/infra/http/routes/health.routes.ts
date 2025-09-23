import { Router } from 'express';

export function healthRouter(_deps?: unknown) {
    const r = Router();

    r.get('/', (_req, res) => {
        res.json({ ok: true });
    });

    return r;
}
