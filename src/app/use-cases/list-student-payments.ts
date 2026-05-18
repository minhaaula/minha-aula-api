import { SchoolFinancialChargeRepository, StudentPaymentInfo } from '../../ports/repositories/school-financial-charge.repo';
import { SchoolFinancialChargeStatus, SchoolFinancialChargeType } from '../../domain/entities/school-financial-charge';
import { SchoolImageRepository } from '../../ports/repositories/school-image.repo';
import { SchoolImageCategory } from '../../domain/value-objects/school-image-category';
import type { StorageProviderPort } from '../../ports/providers/storage-provider.port';
import { formatEnrollmentChargeDescription } from '../../shared/format-school-charge-description';
import { isOpenChargeCalendarOverdue } from '../../shared/billing-due-date';
import { parseDiscountMonthProgress } from '../../shared/parse-discount-month-progress';

export interface ListStudentPaymentsInput {
    userId: string;
    status?: 'pendente' | 'atrasado' | 'pago';
    isPaid?: boolean;
}

/** Tipo da transação para exibição (capitalizado para o cliente). */
export type PaymentTransactionType = 'Mensalidade' | 'Matrícula' | 'Outros';

export interface StudentPaymentRecord {
    chargeId: string;
    courseName: string;
    schoolName: string;
    studentName: string;
    /** Texto para exibição (ex.: "Mensalidade de Fevereiro de 2026"). */
    description: string;
    amountCents: number;
    discountCents: number | null;
    /** Ex.: "1 de 2" — mês atual do desconto na matrícula; null se não houver desconto. */
    discountMonthsLabel: string | null;
    discountMonthIndex: number | null;
    discountMonthsTotal: number | null;
    netAmountCents: number;
    providerNetAmountCents: number | null;
    dueDate: Date;
    paidAt: Date | null;
    status: string;
    type: PaymentTransactionType;
    schoolLogo: string | null;
    paidObservation: string | null;
}

export class ListStudentPayments {
    constructor(
        private readonly financialCharges: SchoolFinancialChargeRepository,
        private readonly schoolImages?: SchoolImageRepository,
        private readonly storage?: StorageProviderPort
    ) {}

    async exec(input: ListStudentPaymentsInput): Promise<{ payments: StudentPaymentRecord[] }> {
        const userId = input.userId?.trim();
        if (!userId) {
            return { payments: [] };
        }

        if (!this.financialCharges.findByOwnerUserId) {
            return { payments: [] };
        }

        // Mapear status do filtro para o status do sistema
        let statusFilter: SchoolFinancialChargeStatus | undefined;
        if (input.status === 'pendente') {
            statusFilter = 'OPEN';
        } else if (input.status === 'atrasado') {
            statusFilter = 'OVERDUE';
        } else if (input.status === 'pago') {
            statusFilter = 'PAID';
        }

        // Buscar pagamentos
        // Se isPaid foi especificado, não usar statusFilter para evitar conflito
        const paymentsData = await this.financialCharges.findByOwnerUserId(userId, {
            status: input.isPaid !== undefined ? undefined : statusFilter,
            isPaid: input.isPaid
        });

        if (paymentsData.length === 0) {
            return { payments: [] };
        }

        const schoolIds = [...new Set(paymentsData.map((d) => d.schoolId))];
        const logoMap = new Map<string, string | null>();
        if (this.schoolImages && this.storage && schoolIds.length > 0) {
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

        const payments: StudentPaymentRecord[] = paymentsData.map((data) => {
            const discountProgress = parseDiscountMonthProgress(data.discountReason, data.discountCents);
            return {
            chargeId: data.chargeId,
            courseName: data.courseName,
            schoolName: data.schoolName,
            studentName: data.studentName,
            description: this.buildPaymentDescription(data),
            amountCents: data.amountCents,
            discountCents: data.discountCents,
            discountMonthsLabel: discountProgress?.label ?? null,
            discountMonthIndex: discountProgress?.current ?? null,
            discountMonthsTotal: discountProgress?.total ?? null,
            netAmountCents: data.netAmountCents,
            providerNetAmountCents: data.providerNetAmountCents ?? null,
            dueDate: data.dueDate,
            paidAt: data.paidAt,
            status: this.getDisplayStatus(data.status, data.dueDate),
            type: this.mapChargeTypeToDisplay(data.chargeType),
            schoolLogo: this.schoolImages && this.storage ? (logoMap.get(data.schoolId) ?? null) : null,
            paidObservation: data.paidObservation
        };
        });

        return { payments };
    }

    private static readonly MONTH_NAMES_PT = [
        'Janeiro',
        'Fevereiro',
        'Março',
        'Abril',
        'Maio',
        'Junho',
        'Julho',
        'Agosto',
        'Setembro',
        'Outubro',
        'Novembro',
        'Dezembro'
    ] as const;

    /**
     * Mensalidade: sempre a partir do vencimento (UTC) — "Mensalidade de {mês} de {ano}".
     * Matrícula: texto com nome do curso (ignora descrições antigas em inglês no banco).
     * Demais tipos: descrição persistida ou "Pagamento".
     */
    private buildPaymentDescription(data: StudentPaymentInfo): string {
        if (data.chargeType === 'TUITION') {
            const d = new Date(data.dueDate);
            const monthName = ListStudentPayments.MONTH_NAMES_PT[d.getUTCMonth()];
            const year = d.getUTCFullYear();
            return `Mensalidade de ${monthName} de ${year}`;
        }

        if (data.chargeType === 'ENROLLMENT') {
            return formatEnrollmentChargeDescription(data.courseName);
        }

        const raw = data.rawDescription?.trim() ?? '';
        if (raw) {
            return raw;
        }

        return 'Pagamento';
    }

    private mapChargeTypeToDisplay(chargeType: SchoolFinancialChargeType): PaymentTransactionType {
        const map: Record<SchoolFinancialChargeType, PaymentTransactionType> = {
            TUITION: 'Mensalidade',
            ENROLLMENT: 'Matrícula',
            MATERIALS: 'Outros',
            DAILY: 'Outros',
            OTHER: 'Outros'
        };
        return map[chargeType] ?? 'Outros';
    }

    private mapStatusToDisplay(status: SchoolFinancialChargeStatus): string {
        const statusMap: Record<SchoolFinancialChargeStatus, string> = {
            'PENDING_SYNC': 'pendente',
            'OPEN': 'pendente',
            'OVERDUE': 'atrasado',
            'PAID': 'pago',
            'CANCELLED': 'cancelado',
            'FAILED': 'falhou'
        };
        return statusMap[status] || status;
    }

    /**
     * Status para exibição. Cobranças em aberto (OPEN/PENDING_SYNC) com vencimento antes do dia civil
     * atual no fuso do app (Brasil) são "atrasado"; não usar só UTC para evitar atraso falso após ~21h BR.
     */
    private getDisplayStatus(status: SchoolFinancialChargeStatus, dueDate: Date): string {
        if (status === 'OPEN' || status === 'PENDING_SYNC') {
            if (isOpenChargeCalendarOverdue(new Date(dueDate))) {
                return 'atrasado';
            }
        }
        return this.mapStatusToDisplay(status);
    }
}

