import { describe, expect, it } from 'vitest';
import { ListMyEnrollmentRequests } from '../../src/app/use-cases/list-my-enrollment-requests';
import { EnrollmentRequestRepository } from '../../src/ports/repositories/enrollment-request.repo';
import { EnrollmentRequest, EnrollmentRequestStatus } from '../../src/domain/entities/enrollment-request';
import { EnrollmentRequestWithDetails } from '../../src/ports/repositories/enrollment-request.repo';

class InMemoryEnrollmentRequestRepository implements EnrollmentRequestRepository {
    private readonly items: EnrollmentRequestWithDetails[] = [];

    async findById(): Promise<EnrollmentRequest | null> {
        return null;
    }

    async findByCourseClassAndTarget(): Promise<EnrollmentRequest | null> {
        return null;
    }

    async findMany(params: {
        schoolId?: string;
        courseClassId?: string;
        courseId?: string;
        status?: EnrollmentRequestStatus;
        requestedForUserId?: string;
        requestedForDependentId?: string | null;
        studentDocument?: string;
        limit?: number;
        offset?: number;
    }): Promise<EnrollmentRequestWithDetails[]> {
        // Filtrar pelos parâmetros
        let filtered = [...this.items];
        
        if (params.requestedForUserId) {
            filtered = filtered.filter((req) => req.request.requestedForUserId === params.requestedForUserId);
        }
        
        if (params.status !== undefined) {
            filtered = filtered.filter((req) => {
                const requestStatus = req.request.status;
                return requestStatus === params.status;
            });
        }
        
        if (params.schoolId) {
            filtered = filtered.filter((req) => req.request.schoolId === params.schoolId);
        }
        
        if (params.courseClassId) {
            filtered = filtered.filter((req) => req.request.courseClassId === params.courseClassId);
        }
        
        if (params.requestedForDependentId !== undefined) {
            if (params.requestedForDependentId === null) {
                filtered = filtered.filter((req) => req.request.requestedForDependentId === null);
            } else {
                filtered = filtered.filter((req) => req.request.requestedForDependentId === params.requestedForDependentId);
            }
        }

        // Ordenar por data de criação (mais recente primeiro)
        const sorted = filtered.sort((a, b) => b.request.createdAt.getTime() - a.request.createdAt.getTime());
        
        const limit = params.limit ?? 50;
        const offset = params.offset ?? 0;
        
        return sorted.slice(offset, offset + limit);
    }

    async save(): Promise<void> {
        // No-op
    }

    seed(requests: EnrollmentRequestWithDetails[]) {
        this.items.length = 0;
        this.items.push(...requests);
    }
}

function makeEnrollmentRequest(
    id: string,
    userId: string,
    status: EnrollmentRequestStatus = 'PENDING',
    dependentId: string | null = null,
    createdAt?: Date
): EnrollmentRequest {
    return EnrollmentRequest.create({
        id,
        schoolId: 'school-1',
        courseClassId: 'class-1',
        requestedForUserId: userId,
        requestedForDependentId: dependentId,
        status,
        firstMonthlyPaymentDate: new Date('2024-02-01'),
        enrollmentFeeCents: null,
        enrollmentFeeDueDate: null,
        discountCents: null,
        notes: null,
        enrollmentId: null,
        decidedAt: null,
        decidedByUserId: null,
        createdAt: createdAt || new Date()
    });
}

function makeRequestWithDetails(
    request: EnrollmentRequest,
    courseLabel: string = 'Curso Teste',
    courseClassLabel: string = 'Turma A',
    studentName: string = 'João Silva',
    dependentName: string | null = null
): EnrollmentRequestWithDetails {
    return {
        request,
        courseLabel,
        courseClassLabel,
        studentName,
        dependentName
    };
}

describe('ListMyEnrollmentRequests use case', () => {
    it('returns all enrollment requests for a user', async () => {
        const repo = new InMemoryEnrollmentRequestRepository();
        const userId = 'user-test-1';

        const baseDate = new Date('2024-01-01T00:00:00Z');
        repo.seed([
            makeRequestWithDetails(makeEnrollmentRequest('req-test-1', userId, 'PENDING', null, new Date(baseDate.getTime() + 2000))),
            makeRequestWithDetails(makeEnrollmentRequest('req-test-2', userId, 'APPROVED', null, new Date(baseDate.getTime() + 1000)))
        ]);

        const useCase = new ListMyEnrollmentRequests(repo);
        const result = await useCase.exec({ userId });

        expect(result.requests).toHaveLength(2);
        // Ordenar por ID para garantir ordem consistente (já que a ordenação é por data)
        const sorted = result.requests.sort((a, b) => a.id.localeCompare(b.id));
        expect(sorted[0].id).toBe('req-test-1');
        expect(sorted[0].status).toBe('PENDING');
        expect(sorted[1].id).toBe('req-test-2');
        expect(sorted[1].status).toBe('APPROVED');
    });

    it('filters by status', async () => {
        const repo = new InMemoryEnrollmentRequestRepository();
        const userId = 'user-test-filter'; // Usar userId único para evitar vazamento

        const baseDate = new Date('2024-01-02T00:00:00Z');
        const requests = [
            makeRequestWithDetails(makeEnrollmentRequest('req-filter-1', userId, 'PENDING', null, new Date(baseDate.getTime() + 2000))),
            makeRequestWithDetails(makeEnrollmentRequest('req-filter-2', userId, 'APPROVED', null, new Date(baseDate.getTime() + 1000))),
            makeRequestWithDetails(makeEnrollmentRequest('req-filter-3', userId, 'REJECTED', null, baseDate))
        ];
        repo.seed(requests);

        const useCase = new ListMyEnrollmentRequests(repo);
        const result = await useCase.exec({ userId, status: 'PENDING' });

        expect(result.requests).toHaveLength(1);
        expect(result.requests[0].id).toBe('req-filter-1');
        expect(result.requests[0].status).toBe('PENDING');
    });

    it('returns empty list when user has no requests', async () => {
        const repo = new InMemoryEnrollmentRequestRepository();
        const userId = 'user-1';

        const useCase = new ListMyEnrollmentRequests(repo);
        const result = await useCase.exec({ userId });

        expect(result.requests).toHaveLength(0);
    });

    it('returns empty list when userId is empty', async () => {
        const repo = new InMemoryEnrollmentRequestRepository();
        const useCase = new ListMyEnrollmentRequests(repo);
        const result = await useCase.exec({ userId: '' });

        expect(result.requests).toHaveLength(0);
    });

    it('only returns requests for the specified user', async () => {
        const repo = new InMemoryEnrollmentRequestRepository();

        repo.seed([
            makeRequestWithDetails(makeEnrollmentRequest('req-1', 'user-1')),
            makeRequestWithDetails(makeEnrollmentRequest('req-2', 'user-2'))
        ]);

        const useCase = new ListMyEnrollmentRequests(repo);
        const result = await useCase.exec({ userId: 'user-1' });

        expect(result.requests).toHaveLength(1);
        expect(result.requests[0].id).toBe('req-1');
    });

    it('includes course and class labels', async () => {
        const repo = new InMemoryEnrollmentRequestRepository();
        const userId = 'user-1';

        repo.seed([
            makeRequestWithDetails(
                makeEnrollmentRequest('req-1', userId),
                'Curso de Música',
                'Turma B',
                'João Silva'
            )
        ]);

        const useCase = new ListMyEnrollmentRequests(repo);
        const result = await useCase.exec({ userId });

        expect(result.requests).toHaveLength(1);
        expect(result.requests[0].courseLabel).toBe('Curso de Música');
        expect(result.requests[0].courseClassLabel).toBe('Turma B');
        expect(result.requests[0].studentName).toBe('João Silva');
    });

    it('handles requests with dependents', async () => {
        const repo = new InMemoryEnrollmentRequestRepository();
        const userId = 'user-1';

        repo.seed([
            makeRequestWithDetails(
                makeEnrollmentRequest('req-1', userId, 'PENDING', 'dep-1'),
                'Curso Teste',
                'Turma A',
                'João Silva',
                'Maria Silva'
            )
        ]);

        const useCase = new ListMyEnrollmentRequests(repo);
        const result = await useCase.exec({ userId });

        expect(result.requests).toHaveLength(1);
        expect(result.requests[0].requestedForDependentId).toBe('dep-1');
        expect(result.requests[0].dependentName).toBe('Maria Silva');
    });

    it('respects limit and offset', async () => {
        const repo = new InMemoryEnrollmentRequestRepository();
        const userId = 'user-test-3';

        const baseDate = new Date('2024-01-03T00:00:00Z');
        repo.seed([
            makeRequestWithDetails(makeEnrollmentRequest('req-test-7', userId, 'PENDING', null, new Date(baseDate.getTime() + 3000))),
            makeRequestWithDetails(makeEnrollmentRequest('req-test-8', userId, 'PENDING', null, new Date(baseDate.getTime() + 2000))),
            makeRequestWithDetails(makeEnrollmentRequest('req-test-9', userId, 'PENDING', null, new Date(baseDate.getTime() + 1000)))
        ]);

        const useCase = new ListMyEnrollmentRequests(repo);
        const result = await useCase.exec({ userId, limit: 2, offset: 1 });

        expect(result.requests).toHaveLength(2);
        // Como está ordenado por data (mais recente primeiro), após offset 1, deve retornar os 2 mais antigos
        // req-test-7 (mais recente) é pulado, então retorna req-test-8 e req-test-9
        expect(result.requests[0].id).toBe('req-test-8');
        expect(result.requests[1].id).toBe('req-test-9');
    });
});

