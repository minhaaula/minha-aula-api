import { describe, expect, it, vi } from 'vitest';
import { ListSchoolStudents } from '../../src/app/use-cases/schools/list-school-students';
import { Course } from '../../src/domain/entities/course';
import { CourseClass } from '../../src/domain/entities/course-class';
import { Enrollment } from '../../src/domain/entities/enrollment';
import { User } from '../../src/domain/entities/user';
import { Dependent } from '../../src/domain/entities/dependent';
import { Email } from '../../src/domain/value-objects/email';
import { PostalAddress } from '../../src/domain/value-objects/postal-address';
import { UserPersonaEnum } from '../../src/domain/value-objects/user-persona';

const address = PostalAddress.create({
    street: 'Rua A',
    number: '1',
    city: 'São Paulo',
    state: 'SP',
    zipCode: '01000000'
});

function makeOwner(id: string, birthDate: Date): User {
    return User.create({
        id,
        fullName: 'Maria Responsável',
        email: Email.create('maria@test.com'),
        phone: '11999999999',
        cpf: '12345678901',
        birthDate,
        address,
        persona: UserPersonaEnum.STUDENT,
        createdAt: new Date('2024-01-01')
    });
}

function makeDependent(id: string, userId: string, birthDate: Date): Dependent {
    return Dependent.create({
        id,
        userId,
        fullName: 'João Dependente',
        cpf: '98765432100',
        birthDate,
        relationship: 'FILHO',
        createdAt: new Date('2024-02-01')
    });
}

describe('ListSchoolStudents — formato admin', () => {
    it('retorna estudante com cursos/turmas, isDependent e responsável', async () => {
        const schoolId = 'school-1';
        const course = Course.create({
            id: 'course-1',
            schoolId,
            name: 'Violão',
            isActive: true,
            createdAt: new Date()
        });
        const courseClass = CourseClass.create({
            id: 'class-1',
            courseId: course.id,
            label: 'Turma A',
            schedule: [{ day: 'Segunda', start: '08:00', end: '09:00' }],
            isActive: true,
            createdAt: new Date()
        });
        const owner = makeOwner('owner-1', new Date('1985-01-01'));
        const dependent = makeDependent('dep-1', owner.id, new Date('2015-03-10'));
        const enrollment = Enrollment.createForDependent({
            id: 'enr-1',
            courseClassId: courseClass.id,
            ownerUserId: owner.id,
            dependentId: dependent.id,
            status: 'ACTIVE',
            enrolledAt: new Date('2025-01-01'),
            updatedAt: new Date('2025-01-01')
        });

        const useCase = new ListSchoolStudents(
            {
                findBySchoolId: vi.fn(async () => [course]),
                findById: vi.fn(async (id: string) => (id === course.id ? course : null))
            } as never,
            {
                findByCourseIds: vi.fn(async () => [courseClass]),
                findById: vi.fn(async (id: string) => (id === courseClass.id ? courseClass : null))
            } as never,
            {
                findActiveByClassIds: vi.fn(async () => [enrollment])
            } as never,
            {
                findById: vi.fn(async (id: string) => (id === owner.id ? owner : null))
            } as never,
            {
                findByUserIds: vi.fn(async () => [dependent])
            } as never
        );

        const result = await useCase.exec({ schoolId, outputFormat: 'admin' });
        expect(result.students).toHaveLength(1);

        const row = result.students[0] as import('../../src/app/use-cases/schools/list-school-students').AdminSchoolStudentItem;
        expect(row.studentId).toBe('dep-1');
        expect(row.isDependent).toBe(true);
        expect(row.birthDate).toEqual(dependent.birthDate);
        expect(row.responsible?.id).toBe('owner-1');
        expect(row.enrollments).toHaveLength(1);
        expect(row.enrollments[0].course.name).toBe('Violão');
        expect(row.enrollments[0].class.label).toBe('Turma A');
    });

    it('inclui isenção de mensalidade nas matrículas do estudante', async () => {
        const schoolId = 'school-1';
        const course = Course.create({
            id: 'course-1',
            schoolId,
            name: 'Violão',
            isActive: true,
            createdAt: new Date()
        });
        const courseClass = CourseClass.create({
            id: 'class-1',
            courseId: course.id,
            label: 'Turma A',
            schedule: [{ day: 'Segunda', start: '08:00', end: '09:00' }],
            isActive: true,
            createdAt: new Date()
        });
        const owner = makeOwner('owner-2', new Date('1985-01-01'));
        const enrollment = Enrollment.createForUser({
            id: 'enr-exempt',
            courseClassId: courseClass.id,
            ownerUserId: owner.id,
            studentUserId: owner.id,
            status: 'ACTIVE',
            enrolledAt: new Date('2025-01-01'),
            updatedAt: new Date('2025-01-01'),
            tuitionExemptionType: 'EMPLOYEE'
        });

        const useCase = new ListSchoolStudents(
            {
                findBySchoolId: vi.fn(async () => [course]),
                findById: vi.fn(async (id: string) => (id === course.id ? course : null))
            } as never,
            {
                findByCourseIds: vi.fn(async () => [courseClass]),
                findById: vi.fn(async (id: string) => (id === courseClass.id ? courseClass : null))
            } as never,
            {
                findActiveByClassIds: vi.fn(async () => [enrollment])
            } as never,
            {
                findById: vi.fn(async (id: string) => (id === owner.id ? owner : null))
            } as never,
            {
                findByUserIds: vi.fn(async () => [])
            } as never
        );

        const result = await useCase.exec({ schoolId, outputFormat: 'admin' });
        const row = result.students[0] as import('../../src/app/use-cases/schools/list-school-students').AdminSchoolStudentItem;
        expect(row.enrollments[0].tuitionExempt).toBe(true);
        expect(row.enrollments[0].tuitionExemptionType).toBe('EMPLOYEE');
    });
});
