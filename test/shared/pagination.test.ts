import { describe, expect, it } from 'vitest';
import { resolvePagination } from '../../src/shared/pagination';

describe('resolvePagination', () => {
    it('converte page em offset', () => {
        expect(resolvePagination({ page: 2, limit: 30 })).toEqual({ limit: 30, offset: 30 });
        expect(resolvePagination({ page: 1, limit: 50 })).toEqual({ limit: 50, offset: 0 });
    });

    it('usa offset quando page não é informada', () => {
        expect(resolvePagination({ offset: 100, limit: 50 })).toEqual({ limit: 50, offset: 100 });
    });

    it('page tem prioridade sobre offset', () => {
        expect(resolvePagination({ page: 3, offset: 0, limit: 20 })).toEqual({ limit: 20, offset: 40 });
    });
});
