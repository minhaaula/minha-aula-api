import { Router } from 'express';
import { CapturePayment } from '../../../app/use-cases/CapturePayment';
import { CreatePayment } from '../../../app/use-cases/create-payment';
import { IssueBoleto } from '../../../app/use-cases/issue-boleto';
import { Money } from '../../../domain/value-objects/money';
import { z } from 'zod';

export function paymentsRouter({ createPayment, capturePayment, issueBoleto }: { createPayment: CreatePayment; capturePayment: CapturePayment; issueBoleto: IssueBoleto; }) {
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
            const result = await createPayment.exec(dto);
            res.status(201).json(result);
        } catch (e) { next(e); }
    });

    r.post('/:id/capture', async (req, res, next) => {
        try {
            const { id } = req.params;
            const schema = z.object({ amount: z.number().int().positive().optional() });
            const { amount } = schema.parse(req.body);
            const result = await capturePayment.exec(id, amount, undefined);
            res.json(result);
        } catch (e) { next(e); }
    });

    r.post('/boletos', async (req, res, next) => {
        try {
            const schema = z.object({
                amount: z.number().int().positive(),
                currency: z.string().length(3).default('BRL'),
                customer: z.object({
                    name: z.string().min(3),
                    email: z.string().email(),
                    cpfCnpj: z.string().min(11),
                    postalCode: z.string().min(8),
                    addressNumber: z.string().min(1),
                    addressComplement: z.string().optional(),
                    phone: z.string().optional()
                }),
                dueDate: z.string().refine((value) => !Number.isNaN(new Date(value).getTime()), { message: 'Invalid due date' }),
                description: z.string().max(255).optional(),
                externalReference: z.string().max(191).optional(),
                metadata: z.record(z.string()).optional()
            });
            const dto = schema.parse(req.body);
            const money = Money.of(dto.amount, dto.currency);
            const dueDate = new Date(dto.dueDate);
            const result = await issueBoleto.exec({
                amount: money,
                customer: {
                    name: dto.customer.name,
                    email: dto.customer.email,
                    cpfCnpj: dto.customer.cpfCnpj.replace(/[^\d]/g, ''),
                    postalCode: dto.customer.postalCode.replace(/[^\d]/g, ''),
                    addressNumber: dto.customer.addressNumber,
                    addressComplement: dto.customer.addressComplement ?? null,
                    phone: dto.customer.phone ?? null
                },
                dueDate,
                description: dto.description ?? null,
                externalReference: dto.externalReference ?? null,
                metadata: dto.metadata ?? undefined
            });
            res.status(201).json(result);
        } catch (e) { next(e); }
    });

    return r;
}
