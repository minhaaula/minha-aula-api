import { AppDataSource } from '../../infra/db/typeorm/datasource';
import { SchoolFinancialChargeOrm } from '../../infra/db/typeorm/entities/school-financial-charge.orm';
import { CourseRepository } from '../../ports/repositories/course.repo';
import { CourseClassRepository } from '../../ports/repositories/course-class.repo';
import { equalUuid } from '../../shared/normalize-uuid';
import { SchoolFinancialChargeStatus } from '../../domain/entities/school-financial-charge';

export interface ConsolidateSchoolPaymentsInput {
    schoolId: string;
    month: number;
    year: number;
}

export interface ConsolidateSchoolPaymentsOutput {
    pendentes: number; // Quantidade de itens pendentes
    pagos: number; // Quantidade de itens pagos
    vencidos: number; // Quantidade de itens vencidos
    totalAReceber: number; // Valor monetário em centavos (pendentes + vencidos)
    totalRecebido: number; // Valor monetário em centavos (pagos)
}

export class ConsolidateSchoolPayments {
    constructor(
        private readonly courses: CourseRepository,
        private readonly classes: CourseClassRepository
    ) {}

    async exec(input: ConsolidateSchoolPaymentsInput): Promise<ConsolidateSchoolPaymentsOutput> {
        const schoolId = input.schoolId?.trim();
        const month = input.month;
        const year = input.year;

        if (!schoolId) {
            throw new Error('School id is required');
        }
        if (!month || month < 1 || month > 12) {
            throw new Error('Month must be between 1 and 12');
        }
        if (!year || year < 2000 || year > 3000) {
            throw new Error('Year must be a valid year');
        }

        // Resolve courses for the school
        const courses = await this.courses.findBySchoolId(schoolId);
        const activeCourses = courses.filter((course) => course.isActive);
        
        if (activeCourses.length === 0) {
            return {
                pendentes: 0,
                pagos: 0,
                vencidos: 0,
                totalAReceber: 0,
                totalRecebido: 0
            };
        }

        const courseIds = activeCourses.map((course) => course.id);

        // Data atual para verificar atrasos
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Query para obter todas as cobranças do mês/ano
        const queryBuilder = AppDataSource.getRepository(SchoolFinancialChargeOrm)
            .createQueryBuilder('charge')
            .where('charge.schoolId = :schoolId', { schoolId })
            .andWhere('charge.courseId IN (:...courseIds)', { courseIds })
            .andWhere('YEAR(charge.dueDate) = :year', { year })
            .andWhere('MONTH(charge.dueDate) = :month', { month })
            .select([
                'charge.netAmountCents AS net_amount_cents',
                'charge.status AS status',
                'charge.dueDate AS due_date'
            ]);

        const charges = await queryBuilder.getRawMany();

        let quantidadePendentes = 0;
        let quantidadeVencidos = 0;
        let quantidadePagos = 0;
        let valorPendentes = 0;
        let valorVencidos = 0;
        let valorPagos = 0;

        for (const charge of charges) {
            const amountCents = charge.net_amount_cents || 0;
            const status = charge.status as SchoolFinancialChargeStatus;
            const dueDate = new Date(charge.due_date);
            dueDate.setHours(0, 0, 0, 0);
            const isOverdue = dueDate < today;

            // Mensalidades pagas
            if (status === 'PAID') {
                quantidadePagos += 1;
                valorPagos += amountCents;
            }
            // Mensalidades em atraso (status OVERDUE ou qualquer status pendente com data vencida)
            else if (status === 'OVERDUE' || ((status === 'OPEN' || status === 'PENDING_SYNC') && isOverdue)) {
                quantidadeVencidos += 1;
                valorVencidos += amountCents;
            }
            // Mensalidades pendentes (OPEN ou PENDING_SYNC que não estão em atraso)
            else if (status === 'OPEN' || status === 'PENDING_SYNC') {
                quantidadePendentes += 1;
                valorPendentes += amountCents;
            }
        }

        // Total a receber = valor de pendentes + valor de vencidos
        const totalAReceber = valorPendentes + valorVencidos;
        // Total recebido = valor de pagos
        const totalRecebido = valorPagos;

        return {
            pendentes: quantidadePendentes,
            pagos: quantidadePagos,
            vencidos: quantidadeVencidos,
            totalAReceber,
            totalRecebido
        };
    }
}

