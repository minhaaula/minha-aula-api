import { Router } from 'express';
import { CapturePayment } from 'src/app/use-cases/CapturePayment';
import { CreatePayment } from 'src/app/use-cases/create-payment';
import { z } from 'zod';

export function paymentsRouter({ createPayment, capturePayment }: { createPayment: CreatePayment; capturePayment: CapturePayment; }) {
    const r = Router();

    r.post('/', async (req, res, next) => {
        try {
            const schema = z.object({
            idempotencyKey: z.string().min(8),
            amount: z.number().int().positive(),
            currency: z.string().length(3),
            method: z.enum(['CARD','PIX','BOLETO']),
            customerId: z.string().min(1),
            metadata: z.record(z.string()).optional()
            });
            const dto = schema.parse(req.body);
            const result = await createPayment.exec(dto);
            res.status(201).json(result);
        } catch (e) { next(e); }
    });


    r.post('/:id/capture', async (req, res, next) => {
        try {
            const { id } = req.params;
            const schema = z.object({ amount: z.number().int().positive().optional() });
            const { amount } = schema.parse(req.body);
            const result = await capturePayment.exec(id, amount);
            res.json(result);
        } catch (e) { next(e); }
    });


    return r;
}