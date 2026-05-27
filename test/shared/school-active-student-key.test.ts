import { describe, expect, it } from 'vitest';
import { resolveSchoolActiveStudentKey } from '../../src/shared/school-active-student-key';

describe('resolveSchoolActiveStudentKey', () => {
    it('titular (USER) usa user:studentUserId ou owner', () => {
        expect(
            resolveSchoolActiveStudentKey({
                studentType: 'USER',
                studentUserId: 'u1',
                ownerUserId: 'o1',
                dependentId: null,
                dependentDeletedAt: null
            })
        ).toBe('user:u1');

        expect(
            resolveSchoolActiveStudentKey({
                studentType: 'USER',
                studentUserId: null,
                ownerUserId: 'o1',
                dependentId: null,
                dependentDeletedAt: null
            })
        ).toBe('user:o1');
    });

    it('dependente ativo usa dep:id', () => {
        expect(
            resolveSchoolActiveStudentKey({
                studentType: 'DEPENDENT',
                studentUserId: null,
                ownerUserId: 'o1',
                dependentId: 'd1',
                dependentDeletedAt: null
            })
        ).toBe('dep:d1');
    });

    it('dependente removido (soft delete) não entra na contagem', () => {
        expect(
            resolveSchoolActiveStudentKey({
                studentType: 'DEPENDENT',
                studentUserId: null,
                ownerUserId: 'o1',
                dependentId: 'd1',
                dependentDeletedAt: new Date()
            })
        ).toBeNull();
    });

    it('DEPENDENT sem dependent_id conta como titular (mesma regra da listagem)', () => {
        expect(
            resolveSchoolActiveStudentKey({
                studentType: 'DEPENDENT',
                studentUserId: null,
                ownerUserId: 'o1',
                dependentId: null,
                dependentDeletedAt: null
            })
        ).toBe('user:o1');
    });
});
