import { EnrollmentRequestStatus } from '../../domain/entities/enrollment-request';
import {
    EnrollmentRequestRepository,
    EnrollmentRequestWithDetails,
    ScheduleEntry
} from '../../ports/repositories/enrollment-request.repo';
import { DependentRepository } from '../../ports/repositories/dependent.repo';
import { SchoolImageRepository } from '../../ports/repositories/school-image.repo';
import { SchoolImageCategory } from '../../domain/value-objects/school-image-category';
import type { StorageProviderPort } from '../../ports/providers/storage-provider.port';

export interface MyEnrollmentRequest {
    id: string;
    status: EnrollmentRequestStatus;
    schoolId: string;
    schoolName: string | null;
    schoolLogo: string | null;
    courseClassId: string;
    courseClassLabel: string | null;
    courseLabel: string | null;
    /** Valor da mensalidade em reais (bruto). */
    monthlyTuitionAmount: number | null;
    /** Desconto em reais (quando houver). */
    discount: number | null;
    /** Valor líquido da mensalidade a pagar em reais (já com desconto aplicado). */
    monthlyTuitionNetAmount: number | null;
    /** Quantidade de meses em que o desconto é válido (ex.: 3 = desconto nos 3 primeiros meses). */
    discountMonths: number | null;
    /** Data até quando o desconto é válido (último dia do último mês com desconto). */
    discountValidUntil: Date | null;
    /** Horários da turma (dia, início, fim). */
    schedule: ScheduleEntry[];
    requestedForUserId: string;
    requestedForDependentId: string | null;
    decidedAt: Date | null;
    decidedByUserId: string | null;
    notes: string | null;
    enrollmentFeeAmount: number | null;
    enrollmentFeeDueDate: Date | null;
    firstMonthlyPaymentDate: Date;
    enrollmentId: string | null;
    createdAt: Date;
    studentName: string | null;
    dependentName: string | null;
}

export class ListMyEnrollmentRequests {
    constructor(
        private readonly requests: EnrollmentRequestRepository,
        private readonly dependents: DependentRepository,
        private readonly schoolImages?: SchoolImageRepository,
        private readonly storage?: StorageProviderPort
    ) {}

    async exec(params: {
        userId: string;
        /** Para a rota do estudante, usar PENDING para retornar apenas pedidos EM ABERTO. */
        status?: EnrollmentRequestStatus | null;
        limit?: number | null;
        offset?: number | null;
    }): Promise<{ requests: MyEnrollmentRequest[] }> {
        const userId = params.userId?.trim();
        if (!userId) {
            return { requests: [] };
        }
        // Só retornar pedidos EM ABERTO (PENDING) quando não informado outro status
        const status: EnrollmentRequestStatus | undefined = params.status ?? 'PENDING';

        // Buscar dependentes do usuário
        const userDependents = await this.dependents.findByUserIds([userId]);
        const dependentIds = userDependents.map((dep) => dep.id);

        // Buscar pedidos de matrícula do usuário (sem dependente)
        const userRequests = await this.requests.findMany({
            requestedForUserId: userId,
            requestedForDependentId: null,
            status
        });

        // Buscar pedidos de matrícula dos dependentes
        const dependentRequestsPromises = dependentIds.map((dependentId) =>
            this.requests.findMany({
                requestedForUserId: userId,
                requestedForDependentId: dependentId,
                status
            })
        );

        const dependentRequestsArrays = await Promise.all(dependentRequestsPromises);
        const allDependentRequests = dependentRequestsArrays.flat();

        // Combinar todos os pedidos
        const allRequests: EnrollmentRequestWithDetails[] = [
            ...userRequests,
            ...allDependentRequests
        ];

        // Ordenar por data de criação (mais recentes primeiro)
        allRequests.sort((a, b) => {
            const dateA = a.request.createdAt.getTime();
            const dateB = b.request.createdAt.getTime();
            return dateB - dateA;
        });

        // Buscar logos das escolas (quando disponíveis)
        const logoMap = new Map<string, string | null>();
        if (this.schoolImages && this.storage) {
            const schoolIds = [...new Set(allRequests.map((r) => r.request.schoolId))];
            await Promise.all(
                schoolIds.map(async (schoolId) => {
                    try {
                        const logos = await this.schoolImages!.findBySchoolId(schoolId, SchoolImageCategory.LOGO);
                        const logo = logos[0];
                        if (logo) {
                            const url = await this.storage!.getFileUrl(logo.key, 3600);
                            logoMap.set(schoolId, url);
                        } else {
                            logoMap.set(schoolId, null);
                        }
                    } catch {
                        logoMap.set(schoolId, null);
                    }
                })
            );
        }

        const mapped: MyEnrollmentRequest[] = allRequests.map((req) => {
            const monthlyCents = req.monthlyPriceCents ?? null;
            const discountCents = req.request.discountCents ?? null;
            const netCents =
                monthlyCents !== null
                    ? discountCents !== null
                        ? Math.max(0, monthlyCents - discountCents)
                        : monthlyCents
                    : null;
            const discountMonths = req.request.discountMonths ?? null;
            const first = req.request.firstMonthlyPaymentDate;
            const discountValidUntil =
                discountMonths != null && discountMonths >= 1
                    ? new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + discountMonths, 0))
                    : null;

            return {
                id: req.request.id,
                status: req.request.status,
                schoolId: req.request.schoolId,
                schoolName: req.schoolName ?? null,
                schoolLogo: this.schoolImages && this.storage ? (logoMap.get(req.request.schoolId) ?? null) : null,
                courseClassId: req.request.courseClassId,
                courseClassLabel: req.courseClassLabel,
                courseLabel: req.courseLabel,
                monthlyTuitionAmount: monthlyCents != null ? monthlyCents / 100 : null,
                discount: discountCents != null ? discountCents / 100 : null,
                monthlyTuitionNetAmount: netCents != null ? netCents / 100 : null,
                discountMonths,
                discountValidUntil,
                schedule: Array.isArray(req.schedule) && req.schedule.length > 0 ? req.schedule : [],
                requestedForUserId: req.request.requestedForUserId,
                requestedForDependentId: req.request.requestedForDependentId,
                decidedAt: req.request.decidedAt,
                decidedByUserId: req.request.decidedByUserId,
                notes: req.request.notes,
                enrollmentFeeAmount: req.request.enrollmentFeeCents !== null ? req.request.enrollmentFeeCents / 100 : null,
                enrollmentFeeDueDate: req.request.enrollmentFeeDueDate,
                firstMonthlyPaymentDate: req.request.firstMonthlyPaymentDate,
                enrollmentId: req.request.enrollmentId,
                createdAt: req.request.createdAt,
                studentName: req.studentName,
                dependentName: req.dependentName
            };
        });

        const limit = params.limit ?? null;
        const offset = params.offset ?? null;
        const safeOffset = typeof offset === 'number' && offset > 0 ? offset : 0;
        const safeLimit = typeof limit === 'number' && limit > 0 ? Math.min(limit, 100) : null;
        const paged = safeLimit === null ? mapped.slice(safeOffset) : mapped.slice(safeOffset, safeOffset + safeLimit);

        return { requests: paged };
    }
}

