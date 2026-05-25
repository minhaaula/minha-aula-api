import { describe, expect, it } from 'vitest';
import { ListSchoolsWithPlans } from '../../src/app/use-cases/admin/list-schools-with-plans';
import { School } from '../../src/domain/entities/school';
import type { SchoolRepository } from '../../src/ports/repositories/school.repo';
import type { SchoolPlanFinanceRepository } from '../../src/ports/repositories/school-plan-finance.repo';
import type { SchoolPlanInvoiceRepository } from '../../src/ports/repositories/school-plan-invoice.repo';
import type { CourseRepository } from '../../src/ports/repositories/course.repo';
import type { CourseClassRepository } from '../../src/ports/repositories/course-class.repo';
import type { EnrollmentRepository } from '../../src/ports/repositories/enrollment.repo';

function makeSchool(id: string, name: string) {
    return School.create({
        id,
        name,
        email: `${id}@school.com`,
        phone: '11999999999',
        ownerName: 'Owner',
        ownerCpf: '12345678909',
        ownerEmail: 'owner@school.com',
        ownerWhatsapp: '11988887777'
    });
}

class InMemorySchools implements Pick<SchoolRepository, 'findAll'> {
    constructor(private readonly schools: School[]) {}
    async findAll() {
        return this.schools;
    }
}

class InMemoryPlanFinances implements Pick<SchoolPlanFinanceRepository, 'findAllBySchoolIds'> {
    async findAllBySchoolIds() {
        return [];
    }
}

class InMemoryInvoices implements Pick<SchoolPlanInvoiceRepository, 'getSchoolIdsWithPaidInvoice'> {
    async getSchoolIdsWithPaidInvoice() {
        return new Set<string>();
    }
}

describe('ListSchoolsWithPlans', () => {
    it('retorna studentCount, courseCount e classCount por escola', async () => {
        const useCase = new ListSchoolsWithPlans(
            new InMemorySchools([makeSchool('school-1', 'Escola A')]) as SchoolRepository,
            new InMemoryPlanFinances() as SchoolPlanFinanceRepository,
            new InMemoryInvoices() as SchoolPlanInvoiceRepository,
            {
                countActiveBySchoolIds: async () => new Map([['school-1', 4]])
            } as CourseRepository,
            {
                countActiveBySchoolIds: async () => new Map([['school-1', 7]])
            } as CourseClassRepository,
            {
                countActiveBySchoolIds: async () => new Map([['school-1', 12]])
            } as EnrollmentRepository
        );

        const result = await useCase.exec({ limit: 50, offset: 0 });

        expect(result.schools[0]).toMatchObject({
            id: 'school-1',
            studentCount: 12,
            courseCount: 4,
            classCount: 7
        });
    });
});
