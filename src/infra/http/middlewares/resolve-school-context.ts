import type { RequestHandler } from 'express';
import type { SchoolRepository } from '../../../ports/repositories/school.repo';
import type { AuthenticatedRequest } from './auth';
import { sanitizeForLogging } from '../../../shared/log-sanitizer';

export interface SchoolContextRequest extends AuthenticatedRequest {
    schoolId?: string;
}

export function makeResolveSchoolContextMiddleware(repo?: SchoolRepository): RequestHandler {
    return async (req, res, next) => {
        const authReq = req as SchoolContextRequest;
        const payload = authReq.user;

        const schoolIdFromToken = typeof payload?.schoolId === 'string' ? payload.schoolId.trim() : '';
        if (schoolIdFromToken) {
            authReq.schoolId = schoolIdFromToken;
            return next();
        }

        if (repo) {
            const email = typeof payload?.email === 'string' ? payload.email.trim().toLowerCase() : '';
            if (email && repo.findByEmail) {
                const school = await repo.findByEmail(email);
                if (school) {
                    authReq.schoolId = school.id;
                    return next();
                }
            }

            const userId = typeof payload?.sub === 'string' ? payload.sub.trim() : '';
            if (userId) {
                const school = repo.findByOwnerUserId
                    ? await repo.findByOwnerUserId(userId)
                    : await repo.findById(userId);
                if (school) {
                    authReq.schoolId = school.id;
                    return next();
                }
            }
        }

        console.warn('School context not resolved for user', sanitizeForLogging({
            userId: payload?.sub ?? null,
            hasTokenSchoolId: Boolean(payload?.schoolId),
            resolvedFromToken: Boolean(schoolIdFromToken),
            repoAvailable: Boolean(repo)
        }));
        res.status(403).json({ error: 'School context not found for user' });
        return;
    };
}
