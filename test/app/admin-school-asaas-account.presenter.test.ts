import { describe, expect, it } from 'vitest';
import { School } from '../../src/domain/entities/school';
import { presentAdminSchoolAsaasAccountFromSchool } from '../../src/app/presenters/admin-school-asaas-account.presenter';

function school(params: Parameters<typeof School.create>[0]) {
    return School.create(params);
}

describe('presentAdminSchoolAsaasAccountFromSchool', () => {
    it('retorna null quando não há accountId', () => {
        const s = school({
            id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
            name: 'Escola Alfa',
            email: 'alfa@exemplo.com',
            phone: '11987654321'
        });
        expect(presentAdminSchoolAsaasAccountFromSchool(s)).toBeNull();
    });

    it('com onboarding concluído força todos os pilares APPROVED e não acumula issues', () => {
        const s = school({
            id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
            name: 'Escola Alfa',
            email: 'alfa@exemplo.com',
            phone: '11987654321',
            accountId: 'cus_asaas',
            onboardingCompletedAt: new Date(),
            accountStatusSnapshot: {
                documentation: 'REJECTED'
            }
        });
        const v = presentAdminSchoolAsaasAccountFromSchool(s)!;
        expect(v.commercialInfo).toBe('APPROVED');
        expect(v.documentation).toBe('APPROVED');
        expect(v.issues).toEqual([]);
        expect(v.summary).toBeNull();
    });

    it('consolida rejeição por pilar e preenche summary', () => {
        const s = school({
            id: 'bbbbbbbb-bbbb-cccc-dddd-eeeeeeeeeeee',
            name: 'Escola Beta',
            email: 'beta@exemplo.com',
            phone: '11987654322',
            accountId: 'cus_beta',
            accountStatusSnapshot: {
                commercialInfo: 'APPROVED',
                bankAccountInfo: 'REJECTED',
                documentation: 'PENDING',
                general: 'PENDING'
            }
        });
        const v = presentAdminSchoolAsaasAccountFromSchool(s)!;
        expect(v.issues.some((i) => i.includes('Conta bancária'))).toBe(true);
        expect(v.summary).toContain('Conta bancária');
    });

    it('usa defaults PENDING quando snapshot não envia valores', () => {
        const s = school({
            id: 'cccccccc-bbbb-cccc-dddd-eeeeeeeeeeee',
            name: 'Escola Gamma',
            email: 'gamma@exemplo.com',
            phone: '11987654323',
            accountId: 'cus_gamma'
        });
        const v = presentAdminSchoolAsaasAccountFromSchool(s)!;
        expect(v.commercialInfo).toBe('PENDING');
        expect(v.bankAccountInfo).toBe('PENDING');
        expect(v.issues).toEqual([]);
    });
});
