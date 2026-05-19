import { describe, expect, it, vi } from 'vitest';
import { ListAdminStudentCharges } from '../../src/app/use-cases/list-admin-student-charges';
import { User } from '../../src/domain/entities/user';
import { Dependent } from '../../src/domain/entities/dependent';
import { Email } from '../../src/domain/value-objects/email';
import { PostalAddress } from '../../src/domain/value-objects/postal-address';
import { UserPersonaEnum } from '../../src/domain/value-objects/user-persona';
import type { AdminStudentChargeItem } from '../../src/ports/repositories/school-financial-charge.repo';

const address = PostalAddress.create({
    street: 'Rua A',
    number: '1',
    city: 'São Paulo',
    state: 'SP',
    zipCode: '01000000'
});

function makeCharge(id: string): AdminStudentChargeItem {
    return {
        id,
        school: { id: 'school-1', name: 'Escola' },
        course: { id: 'course-1', name: 'Curso' },
        class: { id: 'class-1', label: 'Turma A' },
        amountCents: 10000,
        discountCents: null,
        discountReason: null,
        netAmountCents: 10000,
        description: 'Mensalidade',
        chargeType: 'TUITION',
        dueDate: new Date('2026-01-10'),
        status: 'OPEN',
        paidAt: null
    };
}

describe('ListAdminStudentCharges', () => {
    it('separa cobranças do titular e dos dependentes', async () => {
        const owner = User.create({
            id: 'owner-1',
            fullName: 'Maria Titular',
            email: Email.create('maria@test.com'),
            phone: '11999999999',
            cpf: '12345678901',
            birthDate: new Date('1985-01-01'),
            address,
            persona: UserPersonaEnum.STUDENT,
            createdAt: new Date()
        });
        const dep = Dependent.create({
            id: 'dep-1',
            userId: owner.id,
            fullName: 'João Dep',
            cpf: '98765432100',
            birthDate: new Date('2015-01-01'),
            relationship: 'FILHO',
            createdAt: new Date()
        });

        const findChargesByStudentIdForAdmin = vi.fn(
            async (studentId: string, studentType: 'USER' | 'DEPENDENT') => {
                if (studentType === 'USER' && studentId === owner.id) return [makeCharge('charge-owner')];
                if (studentType === 'DEPENDENT' && studentId === dep.id) return [makeCharge('charge-dep')];
                return [];
            }
        );

        const useCase = new ListAdminStudentCharges(
            { findById: vi.fn(async () => owner) } as never,
            { findByUserIds: vi.fn(async () => [dep]), findById: vi.fn() } as never,
            { findChargesByStudentIdForAdmin } as never
        );

        const result = await useCase.exec({ studentId: owner.id });

        expect(result.titular?.studentId).toBe('owner-1');
        expect(result.titular?.charges).toHaveLength(1);
        expect(result.titular?.charges[0].id).toBe('charge-owner');
        expect(result.dependents).toHaveLength(1);
        expect(result.dependents[0].studentId).toBe('dep-1');
        expect(result.dependents[0].charges[0].id).toBe('charge-dep');
    });

    it('retorna titular null e um dependente quando consultado por ID de dependente', async () => {
        const dep = Dependent.create({
            id: 'dep-1',
            userId: 'owner-1',
            fullName: 'João Dep',
            cpf: null,
            birthDate: null,
            relationship: 'FILHO',
            createdAt: new Date()
        });

        const useCase = new ListAdminStudentCharges(
            { findById: vi.fn(async () => null) } as never,
            {
                findById: vi.fn(async () => dep),
                findByUserIds: vi.fn()
            } as never,
            {
                findChargesByStudentIdForAdmin: vi.fn(async () => [makeCharge('charge-dep')])
            } as never
        );

        const result = await useCase.exec({ studentId: dep.id });

        expect(result.titular).toBeNull();
        expect(result.dependents).toHaveLength(1);
        expect(result.dependents[0].charges).toHaveLength(1);
    });
});
