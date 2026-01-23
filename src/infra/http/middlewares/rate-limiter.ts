import rateLimit from 'express-rate-limit';
import { Request, Response } from 'express';

/**
 * Rate limiter padrão para endpoints gerais
 */
export const defaultRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 100, // máximo 100 requisições por IP por janela
    message: 'Muitas requisições deste IP, tente novamente mais tarde.',
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req: Request, res: Response) => {
        res.status(429).json({
            error: 'Muitas requisições',
            code: 'RATE_LIMIT_EXCEEDED',
            message: 'Muitas requisições deste IP, tente novamente mais tarde.'
        });
    }
});

/**
 * Rate limiter agressivo para endpoints de autenticação
 */
export const authRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 5, // máximo 5 tentativas de login por IP por janela
    message: 'Muitas tentativas de login, tente novamente em 15 minutos.',
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: true, // Não contar requisições bem-sucedidas
    handler: (req: Request, res: Response) => {
        res.status(429).json({
            error: 'Muitas tentativas de login',
            code: 'RATE_LIMIT_EXCEEDED',
            message: 'Muitas tentativas de login, tente novamente em 15 minutos.'
        });
    }
});

/**
 * Rate limiter para webhooks (mais permissivo, mas ainda limitado)
 */
export const webhookRateLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minuto
    max: 100, // máximo 100 webhooks por minuto por IP
    message: 'Muitas requisições de webhook, tente novamente mais tarde.',
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req: Request, res: Response) => {
        res.status(429).json({
            error: 'Muitas requisições de webhook',
            code: 'RATE_LIMIT_EXCEEDED',
            message: 'Muitas requisições de webhook, tente novamente mais tarde.'
        });
    }
});

/**
 * Rate limiter para endpoints de registro/reset de senha
 */
export const registrationRateLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hora
    max: 3, // máximo 3 registros/resets por IP por hora
    message: 'Muitas tentativas de registro, tente novamente em 1 hora.',
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req: Request, res: Response) => {
        res.status(429).json({
            error: 'Muitas tentativas de registro',
            code: 'RATE_LIMIT_EXCEEDED',
            message: 'Muitas tentativas de registro, tente novamente em 1 hora.'
        });
    }
});
