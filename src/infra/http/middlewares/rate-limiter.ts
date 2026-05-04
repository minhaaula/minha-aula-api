import rateLimit from 'express-rate-limit';
import { Request, Response } from 'express';

const env = (key: string, defaultNum: number): number => {
    const v = process.env[key];
    if (v === undefined || v === '') return defaultNum;
    const n = parseInt(v, 10);
    return Number.isNaN(n) ? defaultNum : Math.max(1, n);
};

const DEFAULT_WINDOW_MS = 5 * 60 * 1000; // 5 min
/** 2500 / 5 min ≈ 500 req/min em média por IP. */
const DEFAULT_MAX = 2500;
const AUTH_WINDOW_MS = 15 * 60 * 1000;
const AUTH_MAX = 8;
const REGISTRATION_WINDOW_MS = 60 * 60 * 1000; // 1 hora
const REGISTRATION_MAX = 3;
const WEBHOOK_WINDOW_MS = 1 * 60 * 1000; // 1 min
const WEBHOOK_MAX = 800;

function isSkippedFromDefaultRateLimit(req: { path?: string; originalUrl?: string }): boolean {
    const path = req.path ?? '';
    const base = (req.originalUrl ?? '').split('?')[0] ?? '';
    // Webhooks têm limite próprio
    if (path.startsWith('/integrations/asaas') || base.startsWith('/integrations/asaas')) {
        return true;
    }
    // Portal Docusaurus e Swagger UI disparam muitos GETs estáticos (JS/CSS) — não contar no limite global
    if (path.startsWith('/portal') || base.startsWith('/portal')) {
        return true;
    }
    if (path.startsWith('/docs') || base.startsWith('/docs')) {
        return true;
    }
    return false;
}

/**
 * Rate limiter padrão para endpoints gerais (anti-abuso e DDoS leve).
 * Não se aplica a /integrations/asaas (webhooks têm limite próprio).
 * Não se aplica a /portal (site estático) nem a /docs (Swagger UI — muitos assets por página).
 * Padrão: janela de 5 min, até 2500 req/IP (~500/min em média). Configurável: RATE_LIMIT_WINDOW_MS, RATE_LIMIT_MAX
 */
export const defaultRateLimiter = rateLimit({
    windowMs: env('RATE_LIMIT_WINDOW_MS', DEFAULT_WINDOW_MS),
    max: env('RATE_LIMIT_MAX', DEFAULT_MAX),
    message: 'Muitas requisições deste IP, tente novamente mais tarde.',
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => isSkippedFromDefaultRateLimit(req),
    handler: (req: Request, res: Response) => {
        res.status(429).json({
            error: 'Muitas requisições',
            code: 'RATE_LIMIT_EXCEEDED',
            message: 'Muitas requisições deste IP, tente novamente mais tarde.'
        });
    }
});

/**
 * Rate limiter para login e rotas sensíveis (anti brute-force).
 * skipSuccessfulRequests: só conta tentativas falhas.
 * Configurável: RATE_LIMIT_AUTH_WINDOW_MS, RATE_LIMIT_AUTH_MAX
 */
export const authRateLimiter = rateLimit({
    windowMs: env('RATE_LIMIT_AUTH_WINDOW_MS', AUTH_WINDOW_MS),
    max: env('RATE_LIMIT_AUTH_MAX', AUTH_MAX),
    message: 'Muitas tentativas de login, tente novamente em 15 minutos.',
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: true,
    handler: (req: Request, res: Response) => {
        res.status(429).json({
            error: 'Muitas tentativas de login',
            code: 'RATE_LIMIT_EXCEEDED',
            message: 'Muitas tentativas de login, tente novamente em 15 minutos.'
        });
    }
});

/**
 * Rate limiter para webhooks (mais permissivo, mas ainda limitado).
 * Configurável: RATE_LIMIT_WEBHOOK_WINDOW_MS, RATE_LIMIT_WEBHOOK_MAX
 */
export const webhookRateLimiter = rateLimit({
    windowMs: env('RATE_LIMIT_WEBHOOK_WINDOW_MS', WEBHOOK_WINDOW_MS),
    max: env('RATE_LIMIT_WEBHOOK_MAX', WEBHOOK_MAX),
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
 * Rate limiter para registro e solicitação/reset de senha.
 * Configurável: RATE_LIMIT_REGISTRATION_WINDOW_MS, RATE_LIMIT_REGISTRATION_MAX
 */
export const registrationRateLimiter = rateLimit({
    windowMs: env('RATE_LIMIT_REGISTRATION_WINDOW_MS', REGISTRATION_WINDOW_MS),
    max: env('RATE_LIMIT_REGISTRATION_MAX', REGISTRATION_MAX),
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
