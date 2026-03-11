import { SchoolRepository } from '../../ports/repositories/school.repo';
import { CourseClassRepository } from '../../ports/repositories/course-class.repo';
import { EnrollmentRepository } from '../../ports/repositories/enrollment.repo';
import { SchoolFinancialChargeRepository } from '../../ports/repositories/school-financial-charge.repo';
import { SchoolPlanInvoiceRepository } from '../../ports/repositories/school-plan-invoice.repo';
import { ListSchoolsWithPlans } from './list-schools-with-plans';

const MES_ABREV: Record<number, string> = {
    1: 'Jan', 2: 'Fev', 3: 'Mar', 4: 'Abr', 5: 'Mai', 6: 'Jun',
    7: 'Jul', 8: 'Ago', 9: 'Set', 10: 'Out', 11: 'Nov', 12: 'Dez'
};

export type DashboardKpis = {
    totalEscolas: number;
    totalAlunos: number;
    totalEscolasMesAnterior: number;
    totalAlunosMesAnterior: number;
    totalTurmas: number;
    escolasAtivas: number;
    escolasInadimplentes: number;
    matriculasNoMes: number;
    faturamentoEscolasMes: number;
    faturamentoMinhaAulaMes: number;
    faturamentoMinhaAulaMesAnterior: number;
    inadimplenciaTotal: number;
};

export type ReceitaPorMes = { mes: string; valor: number; ano: number };
export type TopEscolaPorAlunos = { nome: string; alunos: number; cidade: string | null };
export type StatusPagamentoMes = { status: string; quantidade: number; valor: number };
export type UltimaEscolaCadastrada = { id: string; nome: string; cidade: string | null; data: string };

export type DashboardOutput = {
    kpis: DashboardKpis;
    receitaPlataformaPorMes: ReceitaPorMes[];
    faturamentoEscolasPorMes: ReceitaPorMes[];
    topEscolasPorAlunos: TopEscolaPorAlunos[];
    statusPagamentosMes: StatusPagamentoMes[];
    ultimasEscolasCadastradas: UltimaEscolaCadastrada[];
};

export class GetAdminDashboard {
    constructor(
        private readonly schools: SchoolRepository,
        private readonly classes: CourseClassRepository,
        private readonly enrollments: EnrollmentRepository,
        private readonly financialCharges: SchoolFinancialChargeRepository,
        private readonly planInvoices: SchoolPlanInvoiceRepository,
        private readonly listSchoolsWithPlans: ListSchoolsWithPlans
    ) {}

    async exec(): Promise<DashboardOutput> {
        const now = new Date();
        const year = now.getFullYear();
        const month = now.getMonth() + 1;
        const lastDayPrevMonth = new Date(year, month - 1, 0);

        const prevYear = lastDayPrevMonth.getFullYear();
        const prevMonth = lastDayPrevMonth.getMonth() + 1;
        const monthsLimit = 6;

        const [
            allSchools,
            totalEscolasMesAnterior,
            totalAlunos,
            totalTurmas,
            schoolsList,
            matriculasNoMes,
            paymentTotals,
            receitaPlataformaRaw,
            faturamentoEscolasRaw,
            topEscolas,
            statusPagamentos,
            ultimasEscolas
        ] = await Promise.all([
            this.schools.findAll(),
            this.schools.countCreatedBefore?.(lastDayPrevMonth) ?? this.schools.findAll().then((s) => s.length),
            this.enrollments.countTotalActiveStudents?.() ?? 0,
            this.classes.countAll?.() ?? 0,
            this.listSchoolsWithPlans.exec({ limit: 1000 }).then((r) => r.schools),
            this.enrollments.countEnrollmentsInMonth?.(year, month) ?? 0,
            this.planInvoices.getPaymentHistoryTotals?.() ?? Promise.resolve({ totalReceivedCents: 0, totalOverdueCents: 0 }),
            this.planInvoices.getRevenueByMonthForDashboard?.(monthsLimit) ?? Promise.resolve([]),
            this.financialCharges.getTuitionRevenueByMonthForDashboard?.(monthsLimit) ?? Promise.resolve([]),
            this.enrollments.getTopSchoolsByStudentCount?.(5) ?? Promise.resolve([]),
            this.planInvoices.getPaymentStatusSummaryForMonth?.(year, month) ?? Promise.resolve([]),
            this.schools.findLatestCreated?.(5) ?? Promise.resolve([])
        ]);

        const inadimplenciaTotal = paymentTotals.totalOverdueCents ?? 0;

        const totalEscolas = allSchools.length;
        const escolasAtivas = schoolsList.filter((s) => s.schoolStatus === 'ACTIVE').length;
        const escolasInadimplentes = schoolsList.filter((s) => s.paymentStatus === 'ATRASADO').length;

        const faturamentoEscolasMes =
            faturamentoEscolasRaw.find((r) => r.year === year && r.month === month)?.valorCents ?? 0;
        const faturamentoMinhaAulaMes =
            receitaPlataformaRaw.find((r) => r.year === year && r.month === month)?.valorCents ?? 0;
        const faturamentoMinhaAulaMesAnterior =
            receitaPlataformaRaw.find((r) => r.year === prevYear && r.month === prevMonth)?.valorCents ?? 0;

        const totalAlunosMesAnterior = Math.max(0, totalAlunos - matriculasNoMes);

        const kpis: DashboardKpis = {
            totalEscolas,
            totalAlunos,
            totalEscolasMesAnterior,
            totalAlunosMesAnterior,
            totalTurmas,
            escolasAtivas,
            escolasInadimplentes,
            matriculasNoMes,
            faturamentoEscolasMes,
            faturamentoMinhaAulaMes,
            faturamentoMinhaAulaMesAnterior,
            inadimplenciaTotal
        };

        const toReceitaPorMes = (rows: Array<{ year: number; month: number; valorCents: number }>): ReceitaPorMes[] =>
            rows.map((r) => ({
                mes: MES_ABREV[r.month] ?? String(r.month),
                valor: r.valorCents,
                ano: r.year
            }));

        const receitaPlataformaPorMes = toReceitaPorMes(receitaPlataformaRaw);
        const faturamentoEscolasPorMes = toReceitaPorMes(faturamentoEscolasRaw);

        const topEscolasPorAlunos: TopEscolaPorAlunos[] = topEscolas.map((s) => ({
            nome: s.schoolName,
            alunos: s.count,
            cidade: s.city
        }));

        const statusPagamentosMes: StatusPagamentoMes[] = statusPagamentos.map((s) => ({
            status: s.status,
            quantidade: s.count,
            valor: s.valorCents
        }));

        const ultimasEscolasCadastradas: UltimaEscolaCadastrada[] = ultimasEscolas.map((s) => ({
            id: s.id,
            nome: s.name,
            cidade: s.city,
            data: s.createdAt.toISOString()
        }));

        return {
            kpis,
            receitaPlataformaPorMes,
            faturamentoEscolasPorMes,
            topEscolasPorAlunos,
            statusPagamentosMes,
            ultimasEscolasCadastradas
        };
    }
}
