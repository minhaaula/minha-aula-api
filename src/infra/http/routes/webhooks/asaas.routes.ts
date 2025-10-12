import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../utils/async-handler';
import type { HandleAsaasPaymentWebhook } from '../../../../app/use-cases/handle-asaas-payment-webhook';

type AsaasWebhookDeps = {
    handleAsaasPaymentWebhook: HandleAsaasPaymentWebhook;
};

const payloadSchema = z.object({
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

export function asaasWebhookRouter(deps: AsaasWebhookDeps) {
    const router = Router();

    router.post('/payments', asyncHandler(async (req, res) => {
        const payload = payloadSchema.parse(req.body ?? {});

        const result = await deps.handleAsaasPaymentWebhook.exec({
            event: payload.event,
            payment: payload.payment ?? undefined
        });

        res.status(200).json({ ok: true, handled: result.handled, reason: result.reason ?? null });
    }));

    return router;
}
