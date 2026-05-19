import { describe, expect, it } from 'vitest';
import { buildReleasedCnpj, buildReleasedCpf, buildReleasedEmail } from '../../src/shared/soft-delete-identifiers';

describe('soft-delete-identifiers', () => {
    const entityId = '6b6cafa8-3e94-4d5e-acd6-75715ace1761';

    it('builds deterministic released email', () => {
        expect(buildReleasedEmail(entityId)).toBe('deleted.6b6cafa83e944d5eacd675715ace1761@removed.local');
    });

    it('builds 11-digit released cpf', () => {
        const cpf = buildReleasedCpf(entityId);
        expect(cpf).toHaveLength(11);
        expect(/^\d{11}$/.test(cpf)).toBe(true);
    });

    it('builds 14-digit released cnpj', () => {
        const cnpj = buildReleasedCnpj(entityId);
        expect(cnpj).toHaveLength(14);
        expect(/^\d{14}$/.test(cnpj)).toBe(true);
    });
});
