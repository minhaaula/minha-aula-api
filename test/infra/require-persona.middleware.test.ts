import { describe, expect, it, vi } from 'vitest';
import { requirePersona } from '../../src/infra/http/middlewares/require-persona';
import type { AuthenticatedRequest } from '../../src/infra/http/middlewares/auth';
import type { Response, NextFunction } from 'express';

const makeResponse = () => {
    const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn().mockReturnThis()
    } as unknown as Response;
    return res;
};

const noopNext: NextFunction = () => {};

describe('requirePersona middleware', () => {
    it('allows requests when persona matches whitelist', () => {
        const middleware = requirePersona('ADMIN', 'SCHOOL');
        const req = { user: { persona: 'SCHOOL' } } as AuthenticatedRequest;
        const res = makeResponse();
        const next = vi.fn();

        middleware(req, res, next);

        expect(next).toHaveBeenCalledOnce();
        expect(res.status).not.toHaveBeenCalled();
    });

    it('denies requests when persona is missing', () => {
        const middleware = requirePersona('ADMIN');
        const req = {} as AuthenticatedRequest;
        const res = makeResponse();

        middleware(req, res, noopNext);

        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith({ error: 'Unauthorized' });
    });

    it('denies requests when persona is not permitted', () => {
        const middleware = requirePersona('ADMIN');
        const req = { user: { persona: 'STUDENT' } } as AuthenticatedRequest;
        const res = makeResponse();

        middleware(req, res, noopNext);

        expect(res.status).toHaveBeenCalledWith(403);
        expect(res.json).toHaveBeenCalledWith({ error: 'Forbidden' });
    });
});
