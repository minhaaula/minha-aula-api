import { describe, expect, it } from 'vitest';
import { patchSchoolStudentSchema } from '../../../src/infra/http/validators/patch-school-student-schemas';
import { updateStudentProfileSchema } from '../../../src/infra/http/validators/student-schemas';

describe('patchSchoolStudentSchema', () => {
    it('aceita apenas dados pessoais (ex.: birthDate)', () => {
        const parsed = patchSchoolStudentSchema.parse({
            birthDate: '2010-05-20',
            fullName: 'Maria Silva'
        });

        expect(parsed.birthDate).toBe('2010-05-20');
        expect(parsed.fullName).toBe('Maria Silva');
    });

    it('rejeita campos de matrícula/mensalidade', () => {
        expect(() =>
            patchSchoolStudentSchema.parse({
                fullName: 'Maria',
                tuitionExempt: true,
                tuitionExemptionType: 'SCHOLARSHIP',
                enrollmentId: '550e8400-e29b-41d4-a716-446655440000'
            })
        ).toThrow();
    });

    it('rejeita profileUpdateVerificationToken (rota do app aluno)', () => {
        expect(() =>
            patchSchoolStudentSchema.parse({
                profileUpdateVerificationToken: 'token',
                fullName: 'João'
            })
        ).toThrow();
    });
});

describe('updateStudentProfileSchema (PUT /students/me)', () => {
    it('rejeita campos de matrícula', () => {
        expect(() =>
            updateStudentProfileSchema.parse({
                profileUpdateVerificationToken: 't',
                tuitionExempt: true
            })
        ).toThrow();
    });

    it('aceita apenas dados pessoais com OTP', () => {
        const parsed = updateStudentProfileSchema.parse({
            profileUpdateVerificationToken: 't',
            fullName: 'João',
            email: 'joao@email.com'
        });
        expect(parsed.fullName).toBe('João');
    });
});
