import { Request, Response, NextFunction, RequestHandler } from 'express';
import { TokenProviderPort } from '../../../ports/providers/token-provider.port';
import { AuthTokenPayload } from '../../../app/contracts/auth-token-payload';

export type AuthenticatedUser = AuthTokenPayload;
export type AuthenticatedRequest = Request & { user?: AuthenticatedUser };

export function makeAuthMiddleware(tokens: TokenProviderPort): RequestHandler {
    return async (req: Request, res: Response, next: NextFunction) => {
        const header = req.headers.authorization;
        if (!header) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const [scheme, token] = header.split(' ');
        if (!token || scheme?.toLowerCase() !== 'bearer') {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        try {
            const payload = await tokens.verify<AuthenticatedUser>(token);
            if (!payload?.sub) {
                return res.status(401).json({ error: 'Unauthorized' });
            }
            (req as AuthenticatedRequest).user = payload;
            next();
        } catch {
            res.status(401).json({ error: 'Unauthorized' });
        }
    };
}
