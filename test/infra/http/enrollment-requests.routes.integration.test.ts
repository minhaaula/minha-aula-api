import express from 'express';
import { describe, expect, it, vi } from 'vitest';
import request from 'supertest';

import { enrollmentRequestsRouter } from '../../../src/infra/http/routes/enrollment-requests.routes';
import { EnrollmentRequest } from '../../../src/domain/entities/enrollment-request';

type UserCtx = { persona: 'STUDENT' | 'ADMIN' | 'SCHOOL'; sub: string; schoolId?: string | null };

function buildTestApp(params: {
    userCtx: UserCtx;
    createEnrollmentRequestExec: ReturnType<typeof vi.fn>;
}) {
    const app = express();
    app.use(express.json());

    // Simula o "auth" setando req.user (as middleware requirePersona dependem disso)
    app.use((req, _res, next) => {
        (req as any).user = {
            persona: params.userCtx.persona,
            sub: params.userCtx.sub,
            schoolId: typeof params.userCtx.schoolId === 'string' ? params.userCtx.schoolId : null
        };
        next();
    });

    const deps = {
        createEnrollmentRequest: { exec: params.createEnrollmentRequestExec },
        approveEnrollmentRequest: { exec: vi.fn(async () => ({})) },
        listEnrollmentRequests: { exec: vi.fn(async () => []) },
        getEnrollmentRequest: { exec: vi.fn(async () => null) },
        issueEnrollmentFeeBoleto: { exec: vi.fn(async () => ({})) }
    };

    app.use('/enrollment-requests', enrollmentRequestsRouter(deps as any));

    // Simplifica erros de validação Zod para o teste
    app.use((err: any, _req: any, res: any, _next: any) => {
        res.status(400).json({
            error: err?.message ?? 'Bad Request',
            code: err?.code ?? undefined
        });
    });

    return app;
}

function buildEnrollmentRequestFromInput(input: any) {
    // route -> use case: discount/enrollmentFeeAmount chegam em reais e datas em string
    const discountCents = input.discount != null ? Math.round(Number(input.discount) * 100) : null;
    const enrollmentFeeCents = input.enrollmentFeeAmount != null ? Math.round(Number(input.enrollmentFeeAmount) * 100) : null;

    return EnrollmentRequest.create({
        id: 'req-test-1',
        schoolId: input.schoolId,
        courseClassId: input.courseClassId,
        requestedForUserId: input.requestedForUserId,
        requestedForDependentId: input.requestedForDependentId ?? null,
        notes: input.notes ?? null,
        discountCents,
        discountMonths: input.discountMonths ?? null,
        enrollmentFeeCents,
        enrollmentFeeDueDate: input.enrollmentFeeDueDate ? new Date(input.enrollmentFeeDueDate) : null,
        firstMonthlyPaymentDate: input.firstMonthlyPaymentDate
            ? new Date(input.firstMonthlyPaymentDate)
            : new Date(),
        tuitionExemptionType: input.tuitionExemptionType ?? null,
        createdAt: new Date('2026-01-01T00:00:00Z')
    });
}

describe('enrollment-requests routes (HTTP)', () => {
    it('STUDENT /requests: não exige requestedForUserId no payload e usa o sub do token', async () => {
        const exec = vi.fn(async (input: any) => buildEnrollmentRequestFromInput(input));

        const app = buildTestApp({
            userCtx: { persona: 'STUDENT', sub: 'a1c3aed9-2a7d-45ea-aa35-d03305b1c693' },
            createEnrollmentRequestExec: exec
        });

        const res = await request(app)
            .post('/enrollment-requests/schools/classes/2c91252e-6ac3-4080-b89f-28e71fa3bd5a/requests')
            .send({
                schoolId: '85a1acc4-9445-4951-944e-4c0fa9e31af4',
                // requestedForUserId omitido: rota STUDENT usa o sub do token (Zod optional não aceita null)
                requestedForDependentId: 'ef73b4e3-d93a-4731-b19e-4cb7a8c8cee2',
                discont: 20,
                discountMonths: 3,
                enrollmentFeeAmount: 100,
                enrollmentFeeDueDate: '2026-03-18',
                firstMonthlyPaymentDate: '2026-03-19',
                notes: 'Dependente'
            });

        expect(res.status).toBe(201);
        expect(exec).toHaveBeenCalledTimes(1);
        expect(exec.mock.calls[0][0]).toMatchObject({
            schoolId: '85a1acc4-9445-4951-944e-4c0fa9e31af4',
            courseClassId: '2c91252e-6ac3-4080-b89f-28e71fa3bd5a',
            requestedForUserId: 'a1c3aed9-2a7d-45ea-aa35-d03305b1c693',
            requestedForDependentId: 'ef73b4e3-d93a-4731-b19e-4cb7a8c8cee2',
            notes: 'Dependente',
            initiatedBySchool: false
        });
    });

    it('STUDENT /requests: se o payload mandar requestedForUserId, ignora e usa o sub do token', async () => {
        const exec = vi.fn(async (input: any) => buildEnrollmentRequestFromInput(input));

        const app = buildTestApp({
            userCtx: { persona: 'STUDENT', sub: 'a1c3aed9-2a7d-45ea-aa35-d03305b1c693' },
            createEnrollmentRequestExec: exec
        });

        const res = await request(app)
            .post('/enrollment-requests/schools/classes/2c91252e-6ac3-4080-b89f-28e71fa3bd5a/requests')
            .send({
                schoolId: '85a1acc4-9445-4951-944e-4c0fa9e31af4',
                // payload tentando sobrescrever o responsável:
                requestedForUserId: '550e8400-e29b-41d4-a716-446655440000',
                requestedForDependentId: 'ef73b4e3-d93a-4731-b19e-4cb7a8c8cee2',
                firstMonthlyPaymentDate: '2026-03-19',
                discont: 20,
                discountMonths: 3
            });

        expect(res.status).toBe(201);
        expect(exec).toHaveBeenCalledTimes(1);
        expect(exec.mock.calls[0][0]).toMatchObject({
            requestedForUserId: 'a1c3aed9-2a7d-45ea-aa35-d03305b1c693',
            requestedForDependentId: 'ef73b4e3-d93a-4731-b19e-4cb7a8c8cee2',
            initiatedBySchool: false
        });
    });

    it('ADMIN/SCHOOL /responsible-requests: exige requestedForUserId no payload', async () => {
        const exec = vi.fn(async (input: any) => buildEnrollmentRequestFromInput(input));

        const app = buildTestApp({
            userCtx: { persona: 'ADMIN', sub: '550e8400-e29b-41d4-a716-446655440000' },
            createEnrollmentRequestExec: exec
        });

        const res = await request(app)
            .post('/enrollment-requests/schools/classes/2c91252e-6ac3-4080-b89f-28e71fa3bd5a/responsible-requests')
            .send({
                schoolId: '85a1acc4-9445-4951-944e-4c0fa9e31af4',
                requestedForDependentId: 'ef73b4e3-d93a-4731-b19e-4cb7a8c8cee2',
                firstMonthlyPaymentDate: '2026-03-19'
            });

        expect(res.status).toBe(400);
        expect(exec).toHaveBeenCalledTimes(0);
    });

    it('ADMIN/SCHOOL /responsible-requests: usa requestedForUserId e requestedForDependentId do payload', async () => {
        const exec = vi.fn(async (input: any) => buildEnrollmentRequestFromInput(input));

        const app = buildTestApp({
            userCtx: {
                persona: 'SCHOOL',
                sub: 'irrelevant-owner-00000000-0000-0000-0000-000000000000',
                schoolId: '85a1acc4-9445-4951-944e-4c0fa9e31af4'
            },
            createEnrollmentRequestExec: exec
        });

        const res = await request(app)
            .post('/enrollment-requests/schools/classes/2c91252e-6ac3-4080-b89f-28e71fa3bd5a/responsible-requests')
            .send({
                requestedForUserId: '550e8400-e29b-41d4-a716-446655440000',
                requestedForDependentId: 'ef73b4e3-d93a-4731-b19e-4cb7a8c8cee2',
                discont: 20,
                discountMonths: 3,
                enrollmentFeeAmount: 100,
                enrollmentFeeDueDate: '2026-03-18',
                firstMonthlyPaymentDate: '2026-03-19',
                notes: 'Dependente'
            });

        expect(res.status).toBe(201);
        expect(exec).toHaveBeenCalledTimes(1);
        expect(exec.mock.calls[0][0]).toMatchObject({
            schoolId: '85a1acc4-9445-4951-944e-4c0fa9e31af4',
            courseClassId: '2c91252e-6ac3-4080-b89f-28e71fa3bd5a',
            requestedForUserId: '550e8400-e29b-41d4-a716-446655440000',
            requestedForDependentId: 'ef73b4e3-d93a-4731-b19e-4cb7a8c8cee2',
            notes: 'Dependente',
            initiatedBySchool: true
        });
    });

    it('SCHOOL /responsible-requests: accepts tuitionExempt true without firstMonthlyPaymentDate', async () => {
        const exec = vi.fn(async (input: any) => buildEnrollmentRequestFromInput(input));

        const app = buildTestApp({
            userCtx: {
                persona: 'SCHOOL',
                sub: 'irrelevant-owner-00000000-0000-0000-0000-000000000000',
                schoolId: '85a1acc4-9445-4951-944e-4c0fa9e31af4'
            },
            createEnrollmentRequestExec: exec
        });

        const res = await request(app)
            .post('/enrollment-requests/schools/classes/2c91252e-6ac3-4080-b89f-28e71fa3bd5a/responsible-requests')
            .send({
                requestedForUserId: '550e8400-e29b-41d4-a716-446655440000',
                tuitionExempt: true,
                tuitionExemptionType: 'EMPLOYEE'
            });

        expect(res.status).toBe(201);
        expect(exec.mock.calls[0][0].tuitionExemptionType).toBe('EMPLOYEE');
    });

    it('SCHOOL /responsible-requests: accepts tuitionExempt true with tuitionExemptionType', async () => {
        const exec = vi.fn(async (input: any) => buildEnrollmentRequestFromInput(input));

        const app = buildTestApp({
            userCtx: {
                persona: 'SCHOOL',
                sub: 'irrelevant-owner-00000000-0000-0000-0000-000000000000',
                schoolId: '85a1acc4-9445-4951-944e-4c0fa9e31af4'
            },
            createEnrollmentRequestExec: exec
        });

        const res = await request(app)
            .post('/enrollment-requests/schools/classes/2c91252e-6ac3-4080-b89f-28e71fa3bd5a/responsible-requests')
            .send({
                requestedForUserId: '550e8400-e29b-41d4-a716-446655440000',
                firstMonthlyPaymentDate: '2026-03-19',
                tuitionExempt: true,
                tuitionExemptionType: 'SCHOLARSHIP'
            });

        expect(res.status).toBe(201);
        expect(res.body.tuitionExempt).toBe(true);
        expect(res.body.tuitionExemptionType).toBe('SCHOLARSHIP');
        expect(exec.mock.calls[0][0]).toMatchObject({
            tuitionExemptionType: 'SCHOLARSHIP',
            initiatedBySchool: true
        });
    });

    it('SCHOOL /responsible-requests: rejects tuitionExempt true without tuitionExemptionType', async () => {
        const exec = vi.fn(async (input: any) => buildEnrollmentRequestFromInput(input));

        const app = buildTestApp({
            userCtx: {
                persona: 'SCHOOL',
                sub: 'irrelevant-owner-00000000-0000-0000-0000-000000000000',
                schoolId: '85a1acc4-9445-4951-944e-4c0fa9e31af4'
            },
            createEnrollmentRequestExec: exec
        });

        const res = await request(app)
            .post('/enrollment-requests/schools/classes/2c91252e-6ac3-4080-b89f-28e71fa3bd5a/responsible-requests')
            .send({
                requestedForUserId: '550e8400-e29b-41d4-a716-446655440000',
                firstMonthlyPaymentDate: '2026-03-19',
                tuitionExempt: true
            });

        expect(res.status).toBe(400);
        expect(exec).toHaveBeenCalledTimes(0);
    });

    it('SCHOOL /responsible-requests: rejects tuitionExemptionType without tuitionExempt true', async () => {
        const exec = vi.fn(async (input: any) => buildEnrollmentRequestFromInput(input));

        const app = buildTestApp({
            userCtx: {
                persona: 'SCHOOL',
                sub: 'irrelevant-owner-00000000-0000-0000-0000-000000000000',
                schoolId: '85a1acc4-9445-4951-944e-4c0fa9e31af4'
            },
            createEnrollmentRequestExec: exec
        });

        const res = await request(app)
            .post('/enrollment-requests/schools/classes/2c91252e-6ac3-4080-b89f-28e71fa3bd5a/responsible-requests')
            .send({
                requestedForUserId: '550e8400-e29b-41d4-a716-446655440000',
                firstMonthlyPaymentDate: '2026-03-19',
                tuitionExemptionType: 'EMPLOYEE'
            });

        expect(res.status).toBe(400);
        expect(exec).toHaveBeenCalledTimes(0);
    });
});

