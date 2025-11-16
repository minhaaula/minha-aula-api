import { UserRepository } from '../../ports/repositories/user.repo';
import { CourseClassRepository } from '../../ports/repositories/course-class.repo';
import { EnrollmentRepository } from '../../ports/repositories/enrollment.repo';
import { SchoolFinancialChargeRepository } from '../../ports/repositories/school-financial-charge.repo';

type RecentStudent = {
    id: string;
    name: string;
    cpf: string;
    enrolledAt: Date;
    courseName: string;
    className: string;
    schoolName: string;
};

type DashboardOutput = {
    totalStudents: number;
    totalClasses: number;
    currentMonthRevenueExpectation: number;
    recentEnrollments: RecentStudent[];
};

export class GetAdminDashboard {
    constructor(
        private readonly users: UserRepository,
        private readonly classes: CourseClassRepository,
        private readonly enrollments: EnrollmentRepository,
        private readonly financialCharges: SchoolFinancialChargeRepository
    ) {}

    async exec(): Promise<DashboardOutput> {
        // Buscar total de alunos (usuários com persona STUDENT)
        const totalStudents = await this.users.countByPersona?.('STUDENT') ?? 0;

        // Buscar total de turmas
        const totalClasses = await this.classes.countAll?.() ?? 0;

        // Buscar previsão de receita do mês atual
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

        const currentMonthCharges = await this.financialCharges.findByDateRange?.(
            startOfMonth,
            endOfMonth
        ) ?? [];

        const currentMonthRevenueExpectation = currentMonthCharges.reduce(
            (sum, charge) => sum + charge.amountCents,
            0
        );

        // Buscar últimos 5 alunos matriculados
        const recentEnrollmentsData = await this.enrollments.findRecent?.(5) ?? [];

        const recentEnrollments: RecentStudent[] = recentEnrollmentsData.map(enrollment => ({
            id: enrollment.studentId,
            name: enrollment.studentName ?? 'N/A',
            cpf: enrollment.studentCpf ?? 'N/A',
            enrolledAt: enrollment.createdAt,
            courseName: enrollment.courseName ?? 'N/A',
            className: enrollment.className ?? 'N/A',
            schoolName: enrollment.schoolName ?? 'N/A'
        }));

        return {
            totalStudents,
            totalClasses,
            currentMonthRevenueExpectation,
            recentEnrollments
        };
    }
}

