import { Router } from 'express';
import { CapturePayment } from '../../../app/use-cases/CapturePayment';
import { CreatePayment } from '../../../app/use-cases/create-payment';
import { z } from 'zod';
import { AuthenticatedRequest } from '../middlewares/auth';

export function paymentsRouter({ createPayment, capturePayment }: { createPayment: CreatePayment; capturePayment: CapturePayment; }) {
    const r = Router();

    r.post('/', async (req, res, next) => {
        try {
            const schema = z.object({
                idempotencyKey: z.string().min(8),
                amount: z.number().int().positive(),
                currency: z.string().length(3),
                method: z.enum(['CARD', 'PIX', 'BOLETO']),
                customerId: z.string().min(1),
                metadata: z.record(z.string()).optional()
            });
            const dto = schema.parse(req.body);
            const authReq = req as AuthenticatedRequest;
            if (!authReq.user) throw new Error('Unauthorized');
            const enriched = { ...dto, metadata: { ...(dto.metadata ?? {}), requestedBy: authReq.user.sub } };
            const result = await createPayment.exec(enriched);
            res.status(201).json(result);
        } catch (e) { next(e); }
    });


    r.post('/:id/capture', async (req, res, next) => {
        try {
            const { id } = req.params;
            const schema = z.object({ amount: z.number().int().positive().optional() });
            const { amount } = schema.parse(req.body);
            const authReq = req as AuthenticatedRequest;
            if (!authReq.user) throw new Error('Unauthorized');
            const result = await capturePayment.exec(id, amount, authReq.user.sub);
            res.json(result);
        } catch (e) { next(e); }
    });


    return r;
}
