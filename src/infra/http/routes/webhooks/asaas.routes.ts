import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../utils/async-handler';
import { log } from '../../../../shared/logger';
import type { HandleAsaasPaymentWebhook } from '../../../../app/use-cases/handle-asaas-payment-webhook';
import type { HandleAsaasAccountWebhook } from '../../../../app/use-cases/handle-asaas-account-webhook';

type AsaasWebhookDeps = {
    handleAsaasPaymentWebhook: HandleAsaasPaymentWebhook;
    handleAsaasAccountWebhook: HandleAsaasAccountWebhook;
};

const paymentPayloadSchema = z.object({
    // Campos no nível raiz (opcionais, pois podem variar)
    id: z.string().optional(),
    event: z.string().min(1),
    dateCreated: z.string().optional(),
    deleted: z.boolean().optional(),
    anticipated: z.boolean().optional(),
    anticipable: z.boolean().optional(),
    // Objeto payment
    payment: z
        .object({
            object: z.string().optional().nullable(),
            id: z.string().optional().nullable(),
            dateCreated: z.string().optional().nullable(),
            customer: z.union([
                z.string(), // Asaas pode enviar como string (ID do cliente)
                z.object({ id: z.string().optional().nullable() }) // Ou como objeto
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
            // Campos adicionais para compatibilidade
            receivedDate: z.string().optional().nullable()
        })
        .passthrough() // Permite campos adicionais não definidos
        .optional()
        .nullable()
}).passthrough(); // Permite campos adicionais no nível raiz

const accountPayloadSchema = z.object({
    // Campos no nível raiz (opcionais, pois podem variar)
    id: z.string().optional(), // ID do evento do Asaas para idempotência
    event: z.string().min(1),
    dateCreated: z.string().optional(),
    account: z
        .object({
            id: z.string().optional().nullable(),
            status: z.string().optional().nullable(),
            externalReference: z.string().optional().nullable(),
            name: z.string().optional().nullable(),
            email: z.string().optional().nullable(),
            cpfCnpj: z.string().optional().nullable(),
            personType: z.string().optional().nullable(),
            companyType: z.string().optional().nullable(),
            dateCreated: z.string().optional().nullable(),
            dateUpdated: z.string().optional().nullable(),
            apiKey: z.string().optional().nullable() // API Key da conta
        })
        .optional()
        .nullable()
}).passthrough(); // Permite campos adicionais no nível raiz

export function asaasWebhookRouter(deps: AsaasWebhookDeps) {
    const router = Router();

    router.post('/payments', asyncHandler(async (req, res) => {
        // Log do evento recebido antes da validação
        log.info('[Asaas Webhook] Evento de pagamento recebido:', {
            path: '/payments',
            body: req.body,
            headers: {
                'content-type': req.headers['content-type'],
                'user-agent': req.headers['user-agent'],
                'x-forwarded-for': req.headers['x-forwarded-for']
            }
        });

        const payload = paymentPayloadSchema.parse(req.body ?? {});

        // Normalizar o payload para o formato esperado pelo use case
        const normalizedPayment = payload.payment && payload.payment.id ? {
            id: String(payload.payment.id), // Garantir que seja string
            status: payload.payment.status ?? null,
            externalReference: payload.payment.externalReference ?? null,
            paymentDate: payload.payment.paymentDate ?? null,
            confirmedDate: payload.payment.confirmedDate ?? null,
            receivedDate: payload.payment.receivedDate ?? null,
            dueDate: payload.payment.dueDate ?? null,
            // Normalizar customer: pode ser string (ID) ou objeto
            customer: typeof payload.payment.customer === 'string'
                ? { id: payload.payment.customer }
                : payload.payment.customer ?? null,
            value: payload.payment.value ?? null
        } : undefined;

        const result = await deps.handleAsaasPaymentWebhook.exec({
            event: payload.event,
            payment: normalizedPayment,
            eventId: payload.id // ID do evento do Asaas para idempotência
        });

        res.status(200).json({ ok: true, handled: result.handled, reason: result.reason ?? null });
    }));

    router.post('/accounts', asyncHandler(async (req, res) => {
        // Log do evento recebido antes da validação
        log.info('[Asaas Webhook] Evento de conta recebido:', {
            path: '/accounts',
            body: req.body,
            headers: {
                'content-type': req.headers['content-type'],
                'user-agent': req.headers['user-agent'],
                'x-forwarded-for': req.headers['x-forwarded-for']
            }
        });

        const payload = accountPayloadSchema.parse(req.body ?? {});

        const result = await deps.handleAsaasAccountWebhook.exec({
            event: payload.event,
            account: payload.account ?? undefined,
            eventId: payload.id // ID do evento do Asaas para idempotência
        });

        res.status(200).json({ ok: true, handled: result.handled, reason: result.reason ?? null });
    }));

    return router;
}
