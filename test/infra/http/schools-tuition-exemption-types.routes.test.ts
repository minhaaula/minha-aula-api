import express from 'express';
import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { buildPublicSchoolRoutes } from '../../../src/infra/http/routes/schools/public.routes';

describe('GET /schools/tuition-exemption-types', () => {
    it('returns catalog of exemption types', async () => {
        const app = express();
        app.use(
            '/schools',
            buildPublicSchoolRoutes(
                {
                    createSchool: { exec: async () => ({}) } as never
                },
                (_req, _res, next) => next()
            )
        );

        const res = await request(app).get('/schools/tuition-exemption-types');

        expect(res.status).toBe(200);
        expect(res.body.items).toHaveLength(4);
        expect(res.body.items[0]).toMatchObject({ value: 'EMPLOYEE', label: 'Funcionário' });
        expect(res.body.items.map((i: { value: string }) => i.value)).toEqual([
            'EMPLOYEE',
            'RELATIVE',
            'SCHOLARSHIP',
            'NONPROFIT'
        ]);
    });
});
