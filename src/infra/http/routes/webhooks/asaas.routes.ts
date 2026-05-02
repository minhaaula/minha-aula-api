import { Router, type Request, type Response } from 'express';
import { z, ZodError } from 'zod';
import { asyncHandler } from '../../utils/async-handler';
import { log } from '../../../../shared/logger';
import { sanitizeForLogging } from '../../../../shared/log-sanitizer';
import { webhookRateLimiter } from '../../middlewares/rate-limiter';
import type { HandleAsaasPaymentWebhook } from '../../../../app/use-cases/handle-asaas-payment-webhook';
import type { HandleAsaasAccountWebhook } from '../../../../app/use-cases/handle-asaas-account-webhook';
import type { HandleAsaasTransferWebhook } from '../../../../app/use-cases/handle-asaas-transfer-webhook';

type AsaasWebhookDeps = {
    handleAsaasPaymentWebhook: HandleAsaasPaymentWebhook;
    handleAsaasAccountWebhook: HandleAsaasAccountWebhook;
    handleAsaasTransferWebhook?: HandleAsaasTransferWebhook;
};

const paymentPayloadSchema = z.object({
    id: z.string().optional(),
    event: z.string().min(1),
    dateCreated: z.string().optional(),
    deleted: z.boolean().optional(),
    anticipated: z.boolean().optional(),
    anticipable: z.boolean().optional(),
    payment: z
        .object({
            object: z.string().optional().nullable(),
            id: z.string().optional().nullable(),
            dateCreated: z.string().optional().nullable(),
            customer: z.union([
                z.string(),
                z.object({ id: z.string().optional().nullable() })
            ]).optional().nullable(),
            checkoutSession: z.any().optional().nullable(),
            paymentLink: z.any().optional().nullable(),
            value: z.number().optional().nullable(),
            netValue: z.number().optional().nullable(),
            originalValue: z.number().optional().nullable(),
            interestValue: z.number().optional().nullable(),
            description: z.string().optional().nullable(),
            billingType: z.string().optional().nullable(),
            canBePaidAfterDueDate: z.boolean().optional().nullable(),
            confirmedDate: z.string().optional().nullable(),
            pixTransaction: z.any().optional().nullable(),
            status: z.string().optional().nullable(),
            dueDate: z.string().optional().nullable(),
            originalDueDate: z.string().optional().nullable(),
            paymentDate: z.string().optional().nullable(),
            clientPaymentDate: z.string().optional().nullable(),
            installmentNumber: z.number().optional().nullable(),
            invoiceUrl: z.string().optional().nullable(),
            refunds: z.any().optional().nullable(),
            invoiceNumber: z.string().optional().nullable(),
            externalReference: z.string().optional().nullable(),
            creditDate: z.string().optional().nullable(),
            estimatedCreditDate: z.string().optional().nullable(),
            transactionReceiptUrl: z.string().optional().nullable(),
            nossoNumero: z.string().optional().nullable(),
            bankSlipUrl: z.string().optional().nullable(),
            lastInvoiceViewedDate: z.string().optional().nullable(),
            lastBankSlipViewedDate: z.string().optional().nullable(),
            discount: z.any().optional().nullable(),
            fine: z.any().optional().nullable(),
            interest: z.any().optional().nullable(),
            postalService: z.boolean().optional().nullable(),
            escrow: z.any().optional().nullable(),
            receivedDate: z.string().optional().nullable()
        })
        .passthrough()
        .optional()
        .nullable()
}).passthrough();

const accountPayloadSchema = z.object({
    id: z.string().optional(),
    event: z.string().min(1),
    dateCreated: z.string().optional(),
    account: z
        .object({
            id: z.string().optional().nullable(),
            ownerId: z.string().optional().nullable(),
            status: z.string().optional().nullable(),
            externalReference: z.string().optional().nullable(),
            name: z.string().optional().nullable(),
            email: z.string().optional().nullable(),
            cpfCnpj: z.string().optional().nullable(),
            personType: z.string().optional().nullable(),
            companyType: z.string().optional().nullable(),
            dateCreated: z.string().optional().nullable(),
            dateUpdated: z.string().optional().nullable(),
            apiKey: z.string().optional().nullable(),
            walletId: z.string().optional().nullable()
        })
        .passthrough()
        .optional()
        .nullable(),
    accountStatus: z
        .object({
            id: z.string().optional().nullable(),
            commercialInfo: z.string().optional().nullable(),
            bankAccountInfo: z.string().optional().nullable(),
            documentation: z.string().optional().nullable(),
            general: z.string().optional().nullable()
        })
        .passthrough()
        .optional()
        .nullable()
}).passthrough();

const transferPayloadSchema = z.object({
    id: z.string().optional(),
    event: z.string().min(1),
    dateCreated: z.string().optional(),
    transfer: z
        .object({
            id: z.string().optional().nullable(),
            status: z.string().optional().nullable(),
            value: z.number().optional().nullable(),
            netValue: z.number().optional().nullable(),
            transferFee: z.number().optional().nullable(),
            effectiveDate: z.string().optional().nullable(),
            scheduleDate: z.string().optional().nullable(),
            dateCreated: z.string().optional().nullable(),
            description: z.string().optional().nullable(),
            failReason: z.string().optional().nullable(),
            externalReference: z.string().optional().nullable(),
            transactionReceiptUrl: z.string().optional().nullable(),
            bankAccount: z.any().optional().nullable()
        })
        .passthrough()
        .optional()
        .nullable()
}).passthrough();

function normalizePaymentMetadata(metadata: unknown): Record<string, string> | null {
    if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return null;
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(metadata)) {
        if (typeof k === 'string' && typeof v === 'string') out[k] = v;
    }
    return Object.keys(out).length ? out : null;
}

/**
 * Coleta todos os tokens de autenticação aceitos pelo endpoint de webhook.
 * Em produção pelo menos um token precisa estar configurado.
 *
 * O Asaas envia o `authToken` que foi cadastrado em **cada** webhook (conta master e subcontas).
 * Como subcontas usam um token diferente da conta master, aceitamos os dois.
 */
function getAcceptedWebhookTokens(): { tokens: string[]; configured: boolean } {
    const main = process.env.ASAAS_WEBHOOK_TOKEN?.trim();
    const sub = process.env.ASAAS_SUBACCOUNT_WEBHOOK_AUTH_TOKEN?.trim();
    const tokens = [main, sub].filter((t): t is string => Boolean(t && t.length > 0));
    return { tokens, configured: tokens.length > 0 };
}

/**
 * Valida o token enviado pelo Asaas no header `asaas-access-token` (ou variantes/query).
 * Retorna `{ ok: true }` quando o token é aceito; `{ ok: false, status, body }` para resposta de erro.
 *
 * - Em produção exige pelo menos um token configurado (caso contrário é erro de configuração 500).
 * - Garante que `ASAAS_WEBHOOK_TOKEN` nunca é igual a `AUTH_TOKEN_SECRET`.
 */
function validateWebhookAccessToken(req: Request, path: string):
    | { ok: true }
    | { ok: false; status: number; body: { error: string } } {
    const authTokenSecret = process.env.AUTH_TOKEN_SECRET?.trim();
    const isProduction = process.env.NODE_ENV === 'production';
    const { tokens, configured } = getAcceptedWebhookTokens();
    const mainToken = process.env.ASAAS_WEBHOOK_TOKEN?.trim();

    if (mainToken && authTokenSecret && mainToken === authTokenSecret) {
        log.error('[Asaas Webhook] CRITICAL SECURITY ERROR: ASAAS_WEBHOOK_TOKEN não pode ser igual a AUTH_TOKEN_SECRET');
        return { ok: false, status: 500, body: { error: 'Configuration error' } };
    }

    if (isProduction && !configured) {
        log.error('[Asaas Webhook] Nenhum token de autenticação configurado para webhooks em produção (ASAAS_WEBHOOK_TOKEN ou ASAAS_SUBACCOUNT_WEBHOOK_AUTH_TOKEN)');
        return { ok: false, status: 500, body: { error: 'Webhook authentication not configured' } };
    }

    if (!configured) {
        return { ok: true };
    }

    const providedToken =
        (req.headers['asaas-access-token'] as string | undefined) ||
        (req.headers['x-asaas-access-token'] as string | undefined) ||
        (typeof req.query.token === 'string' ? req.query.token : undefined);

    if (!providedToken || !tokens.includes(providedToken)) {
        log.warn('[Asaas Webhook] Token de autenticação inválido ou ausente', sanitizeForLogging({
            path,
            hasToken: Boolean(providedToken),
            tokenLength: typeof providedToken === 'string' ? providedToken.length : undefined,
            headers: req.headers,
            body: req.body
        }) as object);
        return { ok: false, status: 401, body: { error: 'Unauthorized' } };
    }

    return { ok: true };
}

/**
 * Faz o parse seguro do payload com Zod. Em caso de erro retorna 200 com handled:false
 * para não pausar a fila do Asaas (que pausa após 15 falhas consecutivas).
 */
function safeParseWebhook<T>(schema: z.ZodType<T>, body: unknown, path: string):
    | { ok: true; payload: T }
    | { ok: false; response: { ok: boolean; handled: boolean; reason: string } } {
    try {
        const payload = schema.parse(body ?? {});
        return { ok: true, payload };
    } catch (err) {
        const issues = err instanceof ZodError ? err.issues.map((i) => `${i.path.join('.')}: ${i.message}`) : [String(err)];
        log.error('[Asaas Webhook] Falha ao validar payload (parse error)', sanitizeForLogging({
            path,
            issues,
            body
        }) as object);
        return { ok: false, response: { ok: true, handled: false, reason: 'parse_error' } };
    }
}

export function asaasWebhookRouter(deps: AsaasWebhookDeps) {
    const router = Router();

    router.use(webhookRateLimiter);

    router.post('/payments', asyncHandler(async (req, res) => {
        const auth = validateWebhookAccessToken(req, '/payments');
        if (!auth.ok) {
            return res.status(auth.status).json(auth.body);
        }

        log.info('[Asaas Webhook] Evento de pagamento recebido:', sanitizeForLogging({
            path: '/payments',
            event: req.body?.event,
            paymentId: req.body?.payment?.id,
            status: req.body?.payment?.status,
            headers: {
                'content-type': req.headers['content-type'],
                'user-agent': req.headers['user-agent'],
                'x-forwarded-for': req.headers['x-forwarded-for']
            }
        }));

        const parsed = safeParseWebhook(paymentPayloadSchema, req.body, '/payments');
        if (!parsed.ok) {
            return res.status(200).json(parsed.response);
        }
        const payload = parsed.payload;

        const normalizedPayment = payload.payment && payload.payment.id ? {
            id: String(payload.payment.id),
            status: payload.payment.status ?? null,
            externalReference: payload.payment.externalReference ?? null,
            paymentDate: payload.payment.paymentDate ?? null,
            confirmedDate: payload.payment.confirmedDate ?? null,
            receivedDate: payload.payment.receivedDate ?? null,
            dueDate: payload.payment.dueDate ?? null,
            customer: typeof payload.payment.customer === 'string'
                ? { id: payload.payment.customer }
                : payload.payment.customer ?? null,
            value: payload.payment.value ?? null,
            metadata: normalizePaymentMetadata((payload.payment as Record<string, unknown>).metadata)
        } : undefined;

        const result = await deps.handleAsaasPaymentWebhook.exec({
            event: payload.event,
            payment: normalizedPayment,
            eventId: payload.id,
            eventCreatedAt: payload.dateCreated ?? null
        });

        return res.status(200).json({ ok: true, handled: result.handled, reason: result.reason ?? null });
    }));

    router.post('/accounts', asyncHandler(async (req, res) => {
        const auth = validateWebhookAccessToken(req, '/accounts');
        if (!auth.ok) {
            return res.status(auth.status).json(auth.body);
        }

        log.info('[Asaas Webhook] Evento de conta recebido:', sanitizeForLogging({
            path: '/accounts',
            event: req.body?.event,
            accountId: req.body?.account?.id,
            status: req.body?.account?.status,
            accountStatus: req.body?.accountStatus,
            headers: {
                'content-type': req.headers['content-type'],
                'user-agent': req.headers['user-agent'],
                'x-forwarded-for': req.headers['x-forwarded-for']
            }
        }));

        const parsed = safeParseWebhook(accountPayloadSchema, req.body, '/accounts');
        if (!parsed.ok) {
            return res.status(200).json(parsed.response);
        }
        const payload = parsed.payload;

        const result = await deps.handleAsaasAccountWebhook.exec({
            event: payload.event,
            account: payload.account ?? undefined,
            accountStatus: payload.accountStatus ?? undefined,
            eventId: payload.id
        });

        return res.status(200).json({ ok: true, handled: result.handled, reason: result.reason ?? null });
    }));

    router.post('/transfers', asyncHandler(async (req, res) => {
        const auth = validateWebhookAccessToken(req, '/transfers');
        if (!auth.ok) {
            return res.status(auth.status).json(auth.body);
        }

        log.info('[Asaas Webhook] Evento de transferência recebido:', sanitizeForLogging({
            path: '/transfers',
            event: req.body?.event,
            transferId: req.body?.transfer?.id,
            status: req.body?.transfer?.status
        }));

        const parsed = safeParseWebhook(transferPayloadSchema, req.body, '/transfers');
        if (!parsed.ok) {
            return res.status(200).json(parsed.response);
        }
        const payload = parsed.payload;

        if (!deps.handleAsaasTransferWebhook) {
            return res.status(200).json({ ok: true, handled: false, reason: 'transfer_handler_not_configured' });
        }

        const result = await deps.handleAsaasTransferWebhook.exec({
            event: payload.event,
            transfer: payload.transfer ?? undefined,
            eventId: payload.id,
            eventCreatedAt: payload.dateCreated ?? null
        });

        return res.status(200).json({ ok: true, handled: result.handled, reason: result.reason ?? null });
    }));

    return router;
}

export const __testing = {
    paymentPayloadSchema,
    accountPayloadSchema,
    transferPayloadSchema,
    getAcceptedWebhookTokens
};
