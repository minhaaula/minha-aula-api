import { Request, Response, NextFunction } from 'express';
import { log } from 'src/shared/logger';

export function requestLogger(req: Request, res: Response, next: NextFunction) {
    const started = Date.now();
    res.on('finish', () => {
        const duration = Date.now() - started;
        log.info(`${req.method} ${req.originalUrl} ${res.statusCode} ${duration}ms`);
    });
    next();
}
