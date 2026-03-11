import { CourseRepository } from '../../ports/repositories/course.repo';
import { CourseClassRepository } from '../../ports/repositories/course-class.repo';
import { EnrollmentRepository, EnrollmentWithDetails } from '../../ports/repositories/enrollment.repo';
import { SchoolFinancialChargeRepository } from '../../ports/repositories/school-financial-charge.repo';
import { EnrollmentRequestRepository } from '../../ports/repositories/enrollment-request.repo';

export interface GetSchoolDashboardInput {
    schoolId: string;
}

export interface GetSchoolDashboardOutput {
    totalStudents: number;
    totalClasses: number;
    totalCourses: number;
    currentMonthRevenueCents: number;
    revenueForecastCents: number;
    revenueChangePercentage: number;
    recentEnrollments: EnrollmentWithDetails[];
    /** Cobranças em aberto (pendentes + atrasadas): valor e quantidade a receber. */
    pendingPayments: {
        totalAmountCents: number;
        count: number;
    };
    /** Cobranças em atraso (vencidas e não pagas): valor e quantidade. */
    overduePayments: {
        totalAmountCents: number;
        count: number;
    };
    monthlyRevenueHistory: Array<{
        month: string;
        valueCents: number;
    }>;
    pendingEnrollmentRequestsCount: number;
}

export class GetSchoolDashboard {
    constructor(
        private readonly courses: CourseRepository,
        private readonly classes: CourseClassRepository,
        private readonly enrollments: EnrollmentRepository,
        private readonly charges: SchoolFinancialChargeRepository,
        private readonly enrollmentRequests: EnrollmentRequestRepository
    ) {}

    async exec(input: GetSchoolDashboardInput): Promise<GetSchoolDashboardOutput> {
        const { schoolId } = input;

        if (!schoolId) {
            throw new Error('School ID is required');
        }

        const now = new Date();
        const currentMonth = now.getMonth() + 1;
        const currentYear = now.getFullYear();

        // 1. Total de Alunos
        const totalStudents = await this.enrollments.countActiveBySchoolId!(schoolId);

        // 2. Total de Turmas
        const totalClasses = await this.classes.countActiveBySchoolId!(schoolId);

        // 3. Total de Cursos
        const totalCourses = await this.courses.countActiveBySchoolId!(schoolId);

        // 4. Receita Recebida do Mês Atual (pagos)
        const currentMonthRevenueCents = await this.charges.getCurrentMonthRevenue!(schoolId, currentMonth, currentYear);

        // 5. Previsão de Receita (Mês Atual) - cobranças pendentes/abertas
        const revenueForecastCents = await this.charges.getRevenueForecast!(schoolId, currentMonth, currentYear);

        // 6. Histórico de Receita Mensal (Últimos 6 meses)
        const monthlyRevenueHistory = await this.charges.getRevenueHistory!(schoolId, 6);

        // 7. Porcentagem de Mudança de Receita (Relação ao mês passado)
        const revenueChangePercentage = this.calculateRevenueChange(monthlyRevenueHistory);

        // 8. Últimos Alunos Matriculados (5)
        const recentEnrollments = await this.enrollments.findRecentBySchoolId!(schoolId, 5);

        // 9. Pagamentos pendentes (todas as cobranças em aberto: PENDING_SYNC, OPEN, FAILED)
        const pendingPayments = await this.charges.getPendingSummary!(schoolId);

        // 10. Pagamentos em Atraso (OVERDUE ou abertas com dueDate < hoje)
        const overduePayments = await this.charges.getOverdueSummary!(schoolId);

        // 11. Solicitações de Matrícula Pendentes
        const pendingEnrollmentRequestsCount = await this.enrollmentRequests.countPendingBySchoolId!(schoolId);

        return {
            totalStudents,
            totalClasses,
            totalCourses,
            currentMonthRevenueCents,
            revenueForecastCents,
            revenueChangePercentage,
            recentEnrollments,
            pendingPayments,
            overduePayments,
            monthlyRevenueHistory,
            pendingEnrollmentRequestsCount
        };
    }

    private calculateRevenueChange(history: Array<{ month: string; valueCents: number }>): number {
        if (history.length < 2) return 0;

        // O histórico vem ordenado e revertido para [antigo -> novo]
        const currentMonthData = history[history.length - 1];
        const lastMonthData = history[history.length - 2];

        if (!lastMonthData || lastMonthData.valueCents === 0) return 0;

        const change = ((currentMonthData.valueCents - lastMonthData.valueCents) / lastMonthData.valueCents) * 100;
        return Number(change.toFixed(2));
    }
}

