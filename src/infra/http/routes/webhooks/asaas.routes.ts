import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../utils/async-handler';
import type { HandleAsaasPaymentWebhook } from '../../../../app/use-cases/handle-asaas-payment-webhook';
import type { HandleAsaasAccountWebhook } from '../../../../app/use-cases/handle-asaas-account-webhook';

type AsaasWebhookDeps = {
    handleAsaasPaymentWebhook: HandleAsaasPaymentWebhook;
    handleAsaasAccountWebhook: HandleAsaasAccountWebhook;
};

const paymentPayloadSchema = z.object({
    event: z.string().min(1),
    payment: z
        .object({
            id: z.string().min(1),
            status: z.string().optional().nullable(),
            externalReference: z.string().optional().nullable(),
            paymentDate: z.string().optional().nullable(),
            confirmedDate: z.string().optional().nullable(),
            receivedDate: z.string().optional().nullable(),
            dueDate: z.string().optional().nullable(),
            customer: z.object({ id: z.string().optional().nullable() }).optional().nullable(),
            value: z.number().optional().nullable()
        })
        .optional()
        .nullable()
});

const accountPayloadSchema = z.object({
    event: z.string().min(1),
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
            dateUpdated: z.string().optional().nullable()
        })
        .optional()
        .nullable()
});

export function asaasWebhookRouter(deps: AsaasWebhookDeps) {
    const router = Router();

    router.post('/payments', asyncHandler(async (req, res) => {
        const payload = paymentPayloadSchema.parse(req.body ?? {});

        const result = await deps.handleAsaasPaymentWebhook.exec({
            event: payload.event,
            payment: payload.payment ?? undefined
        });

        res.status(200).json({ ok: true, handled: result.handled, reason: result.reason ?? null });
    }));

    router.post('/accounts', asyncHandler(async (req, res) => {
        const payload = accountPayloadSchema.parse(req.body ?? {});

        const result = await deps.handleAsaasAccountWebhook.exec({
            event: payload.event,
            account: payload.account ?? undefined
        });

        res.status(200).json({ ok: true, handled: result.handled, reason: result.reason ?? null });
    }));

    return router;
}
