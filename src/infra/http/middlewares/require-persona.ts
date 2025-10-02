import { RequestHandler } from 'express';
import { AuthenticatedRequest } from './auth';
import { UserPersona } from '../../../domain/value-objects/user-persona';

export function requirePersona(...allowed: UserPersona[]): RequestHandler {
    const whitelist = allowed.length ? new Set<UserPersona>(allowed) : null;

    return (req, res, next) => {
        const authReq = req as AuthenticatedRequest;
        const persona = authReq.user?.persona;

        if (!persona) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        if (whitelist && !whitelist.has(persona)) {
            return res.status(403).json({ error: 'Forbidden' });
        }

        next();
    };
}
