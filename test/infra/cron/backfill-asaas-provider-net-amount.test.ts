import { describe, expect, it } from 'vitest';
import { isMissingProviderNetAmountCents } from '../../../src/infra/cron/backfill-asaas-provider-net-amount';

describe('cron/backfill-asaas-provider-net-amount', () => {
    describe('isMissingProviderNetAmountCents', () => {
        it('considera null como ausente', () => {
            expect(isMissingProviderNetAmountCents(null)).toBe(true);
        });

        it('considera 0 como presente (não será alterado pelo backfill)', () => {
            expect(isMissingProviderNetAmountCents(0)).toBe(false);
        });

        it('considera negativo como presente (valor persistido)', () => {
            expect(isMissingProviderNetAmountCents(-1)).toBe(false);
        });

        it('considera positivo como presente', () => {
            expect(isMissingProviderNetAmountCents(1)).toBe(false);
            expect(isMissingProviderNetAmountCents(1234)).toBe(false);
        });
    });
});

