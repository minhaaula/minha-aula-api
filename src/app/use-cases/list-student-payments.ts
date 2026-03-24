import { SchoolFinancialChargeRepository, StudentPaymentInfo } from '../../ports/repositories/school-financial-charge.repo';
import { SchoolFinancialChargeStatus, SchoolFinancialChargeType } from '../../domain/entities/school-financial-charge';
import { SchoolImageRepository } from '../../ports/repositories/school-image.repo';
import { SchoolImageCategory } from '../../domain/value-objects/school-image-category';
import type { StorageProviderPort } from '../../ports/providers/storage-provider.port';

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
    studentName: string;
    /** Texto para exibição (ex.: "Mensalidade de Fevereiro de 2026"). */
    description: string;
    amountCents: number;
    discountCents: number | null;
    netAmountCents: number;
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

        const payments: StudentPaymentRecord[] = paymentsData.map((data) => ({
            chargeId: data.chargeId,
            courseName: data.courseName,
            studentName: data.studentName,
            description: this.buildPaymentDescription(data),
            amountCents: data.amountCents,
            discountCents: data.discountCents,
            netAmountCents: data.netAmountCents,
            dueDate: data.dueDate,
            paidAt: data.paidAt,
            status: this.getDisplayStatus(data.status, data.dueDate),
            type: this.mapChargeTypeToDisplay(data.chargeType),
            schoolLogo: this.schoolImages && this.storage ? (logoMap.get(data.schoolId) ?? null) : null,
            paidObservation: data.paidObservation
        }));

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
     * Demais tipos: descrição persistida ou fallback pelo tipo/curso.
     */
    private buildPaymentDescription(data: StudentPaymentInfo): string {
        if (data.chargeType === 'TUITION') {
            const d = new Date(data.dueDate);
            const monthName = ListStudentPayments.MONTH_NAMES_PT[d.getUTCMonth()];
            const year = d.getUTCFullYear();
            return `Mensalidade de ${monthName} de ${year}`;
        }

        const raw = data.rawDescription?.trim() ?? '';
        if (raw) {
            return raw;
        }

        if (data.chargeType === 'ENROLLMENT') {
            return `Matrícula — ${data.courseName}`;
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
     * Status para exibição. Cobranças em aberto (OPEN/PENDING_SYNC) com data de vencimento
     * já passada são exibidas como "atrasado" em vez de "pendente".
     * Comparação em UTC para não depender do fuso do servidor.
     */
    private getDisplayStatus(status: SchoolFinancialChargeStatus, dueDate: Date): string {
        if (status === 'OPEN' || status === 'PENDING_SYNC') {
            const now = new Date();
            const todayUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
            const d = new Date(dueDate);
            const dueUtc = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
            if (dueUtc < todayUtc) {
                return 'atrasado';
            }
        }
        return this.mapStatusToDisplay(status);
    }
}

