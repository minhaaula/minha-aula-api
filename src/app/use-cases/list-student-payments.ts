import { SchoolFinancialChargeRepository, StudentPaymentInfo } from '../../ports/repositories/school-financial-charge.repo';
import { SchoolFinancialChargeStatus } from '../../domain/entities/school-financial-charge';

export interface ListStudentPaymentsInput {
    userId: string;
    status?: 'pendente' | 'atrasado' | 'pago';
    isPaid?: boolean;
}

export interface StudentPaymentRecord {
    courseName: string;
    studentName: string;
    amountCents: number;
    dueDate: Date;
    status: string;
}

export class ListStudentPayments {
    constructor(
        private readonly financialCharges: SchoolFinancialChargeRepository
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
        const paymentsData = await this.financialCharges.findByOwnerUserId(userId, {
            status: statusFilter,
            isPaid: input.isPaid
        });

        // Mapear para o formato de resposta
        const payments: StudentPaymentRecord[] = paymentsData.map((data) => ({
            courseName: data.courseName,
            studentName: data.studentName,
            amountCents: data.amountCents,
            dueDate: data.dueDate,
            status: this.mapStatusToDisplay(data.status)
        }));

        return { payments };
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
}

