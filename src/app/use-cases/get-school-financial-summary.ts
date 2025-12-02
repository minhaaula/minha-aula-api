import { SchoolFinancialChargeRepository } from '../../ports/repositories/school-financial-charge.repo';

export interface GetSchoolFinancialSummaryInput {
    schoolId: string;
}

export interface AvailableWithdrawal {
    id: string;
    netAmountCents: number;
    paidAt: Date;
    description: string | null;
    studentName: string;
    courseName: string;
}

export interface GetSchoolFinancialSummaryOutput {
    availableWithdrawals: AvailableWithdrawal[];
    availableBalanceCents: number;
    totalReceivedThisMonthCents: number;
}

export class GetSchoolFinancialSummary {
    constructor(
        private readonly financialCharges: SchoolFinancialChargeRepository
    ) {}

    async exec(input: GetSchoolFinancialSummaryInput): Promise<GetSchoolFinancialSummaryOutput> {
        const schoolId = input.schoolId?.trim();
        if (!schoolId) {
            throw new Error('School id is required');
        }

        if (!this.financialCharges.findPaidChargesBySchoolId) {
            throw new Error('Financial charges repository does not support findPaidChargesBySchoolId');
        }

        const now = new Date();
        const currentMonth = now.getMonth() + 1; // getMonth() retorna 0-11
        const currentYear = now.getFullYear();

        // Buscar todos os pagamentos pagos da escola através do repositório
        const allPaidCharges = await this.financialCharges.findPaidChargesBySchoolId(schoolId);

        // Calcular saldo disponível (soma de todos os pagamentos pagos)
        const availableBalanceCents = allPaidCharges.reduce(
            (sum, charge) => sum + charge.netAmountCents,
            0
        );

        // Filtrar pagamentos do mês atual
        const thisMonthCharges = allPaidCharges.filter((charge) => {
            const paidAt = charge.paidAt;
            return (
                paidAt.getMonth() + 1 === currentMonth &&
                paidAt.getFullYear() === currentYear
            );
        });

        // Calcular total recebido neste mês
        const totalReceivedThisMonthCents = thisMonthCharges.reduce(
            (sum, charge) => sum + charge.netAmountCents,
            0
        );

        // Listar saques disponíveis (últimos 30 pagamentos pagos, ordenados por data de pagamento)
        const availableWithdrawals: AvailableWithdrawal[] = allPaidCharges
            .slice(0, 30)
            .map((charge) => ({
                id: charge.id,
                netAmountCents: charge.netAmountCents,
                paidAt: charge.paidAt,
                description: charge.description,
                studentName: charge.studentName,
                courseName: charge.courseName
            }));

        return {
            availableWithdrawals,
            availableBalanceCents,
            totalReceivedThisMonthCents
        };
    }
}

