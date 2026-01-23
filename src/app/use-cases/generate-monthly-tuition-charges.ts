import { EnrollmentRepository } from '../../ports/repositories/enrollment.repo';
import { SchoolFinancialChargeRepository } from '../../ports/repositories/school-financial-charge.repo';
import { CourseRepository } from '../../ports/repositories/course.repo';
import { CourseClassRepository } from '../../ports/repositories/course-class.repo';
import { EnrollmentRequestRepository } from '../../ports/repositories/enrollment-request.repo';
import { SchoolFinancialCharge } from '../../domain/entities/school-financial-charge';
import { Uuid } from '../../shared/uuid';
import { log } from '../../shared/logger';
import { AppDataSource } from '../../infra/db/typeorm/datasource';
import { EnrollmentOrm } from '../../infra/db/typeorm/entities/enrollment.orm';
import { Enrollment } from '../../domain/entities/enrollment';

type GenerateMonthlyTuitionChargesInput = {
    targetMonth?: number; // 1-12, se não fornecido usa o próximo mês
    targetYear?: number; // se não fornecido usa o ano atual ou próximo
};

type GenerateMonthlyTuitionChargesOutput = {
    generated: number;
    skipped: number;
    errors: number;
    details: Array<{
        enrollmentId: string;
        courseName: string;
        studentName: string;
        status: 'generated' | 'skipped' | 'error';
        reason?: string;
    }>;
};

export class GenerateMonthlyTuitionCharges {
    constructor(
        private readonly enrollments: EnrollmentRepository,
        private readonly charges: SchoolFinancialChargeRepository,
        private readonly courses: CourseRepository,
        private readonly classes: CourseClassRepository,
        private readonly enrollmentRequests?: EnrollmentRequestRepository
    ) {}

    async exec(input: GenerateMonthlyTuitionChargesInput = {}): Promise<GenerateMonthlyTuitionChargesOutput> {
        const now = new Date();
        const currentDay = now.getDate();
        const currentMonth = now.getMonth() + 1; // 1-12
        const currentYear = now.getFullYear();

        // Se não especificado, calcular mês/ano baseado na lógica: gerar 10 dias antes do vencimento
        // Exemplo: se vence dia 10, gera no dia 1 do mesmo mês
        let targetMonth: number;
        let targetYear: number;

        if (input.targetMonth && input.targetYear) {
            targetMonth = input.targetMonth;
            targetYear = input.targetYear;
        } else {
            // Calcular para o próximo mês (gerar cobranças que vencem no próximo mês)
            targetMonth = currentMonth + 1;
            targetYear = currentYear;
            if (targetMonth > 12) {
                targetMonth = 1;
                targetYear = currentYear + 1;
            }
        }

        log.info('[GenerateMonthlyTuitionCharges] Iniciando geração de cobranças mensais', {
            currentDay,
            currentMonth,
            currentYear,
            targetMonth,
            targetYear
        });

        // Buscar todas as matrículas ativas usando query direta no banco
        const repo = AppDataSource.getRepository(EnrollmentOrm);
        const enrollmentRows = await repo.find({
            where: { status: 'ACTIVE' }
        });

        const activeEnrollments: Enrollment[] = enrollmentRows.map((row) => {
            if (row.studentType === 'USER') {
                return Enrollment.createForUser({
                    id: row.id,
                    courseClassId: row.courseClassId,
                    ownerUserId: row.ownerUserId,
                    studentUserId: row.studentUserId!,
                    status: row.status as any,
                    enrolledAt: row.enrolledAt,
                    updatedAt: row.updatedAt,
                    fullAmountCents: row.fullAmountCents,
                    paymentDueDay: row.paymentDueDay
                });
            }
            return Enrollment.createForDependent({
                id: row.id,
                courseClassId: row.courseClassId,
                ownerUserId: row.ownerUserId,
                dependentId: row.dependentId!,
                status: row.status as any,
                enrolledAt: row.enrolledAt,
                updatedAt: row.updatedAt,
                fullAmountCents: row.fullAmountCents,
                paymentDueDay: row.paymentDueDay
            });
        });

        // Filtrar apenas enrollments que devem ter cobrança gerada hoje
        // Lógica: gerar 10 dias antes do vencimento
        // Exemplo: se vence dia 10, gera no dia 1 do mesmo mês (10 - 10 + 1 = 1)
        // Exemplo: se vence dia 5, gera no dia 26 do mês anterior (5 - 10 = -5, então último dia do mês anterior - 4)
        const enrollmentsToProcess = activeEnrollments.filter((enrollment) => {
            const dueDay = enrollment.paymentDueDay; // Dia do mês que vence (1-31)
            const generationDay = dueDay - 10; // Dia que deve gerar (10 dias antes)
            
            // Se generationDay for negativo ou zero, gerar no mês anterior
            // Exemplo: se vence dia 5, generationDay = -5, então gera no dia (último dia - 4) do mês anterior
            if (generationDay <= 0) {
                // Calcular último dia do mês anterior
                const lastMonth = currentMonth === 1 ? 12 : currentMonth - 1;
                const lastMonthYear = currentMonth === 1 ? currentYear - 1 : currentYear;
                const lastDayOfLastMonth = new Date(lastMonthYear, lastMonth, 0).getDate();
                const adjustedGenerationDay = lastDayOfLastMonth + generationDay + 1; // +1 porque generationDay é negativo
                // Verificar se hoje é o mês anterior e o dia correto
                return currentDay === adjustedGenerationDay && currentMonth === lastMonth && currentYear === lastMonthYear;
            }
            
            // Se generationDay é positivo, gerar no mesmo mês
            return currentDay === generationDay;
        });

        log.info('[GenerateMonthlyTuitionCharges] Matrículas filtradas para processamento', {
            total: activeEnrollments.length,
            toProcess: enrollmentsToProcess.length,
            currentDay
        });

        log.info('[GenerateMonthlyTuitionCharges] Matrículas ativas encontradas', {
            count: activeEnrollments.length
        });

        const result: GenerateMonthlyTuitionChargesOutput = {
            generated: 0,
            skipped: 0,
            errors: 0,
            details: []
        };

        for (const enrollment of enrollmentsToProcess) {
            try {
                const detail = await this.processEnrollment(enrollment, currentMonth, currentYear);
                result.details.push(detail);

                if (detail.status === 'generated') {
                    result.generated++;
                } else if (detail.status === 'skipped') {
                    result.skipped++;
                } else {
                    result.errors++;
                }
            } catch (error) {
                result.errors++;
                result.details.push({
                    enrollmentId: enrollment.id,
                    courseName: 'N/A',
                    studentName: 'N/A',
                    status: 'error',
                    reason: error instanceof Error ? error.message : 'Erro desconhecido'
                });
                log.error('[GenerateMonthlyTuitionCharges] Erro ao processar matrícula', {
                    enrollmentId: enrollment.id,
                    error: error instanceof Error ? error.message : String(error)
                });
            }
        }

        log.info('[GenerateMonthlyTuitionCharges] Processamento concluído', {
            generated: result.generated,
            skipped: result.skipped,
            errors: result.errors
        });

        return result;
    }

    private async processEnrollment(
        enrollment: import('../../domain/entities/enrollment').Enrollment,
        currentMonth: number,
        currentYear: number
    ): Promise<GenerateMonthlyTuitionChargesOutput['details'][0]> {
        // Buscar dados do curso e turma
        const courseClass = await this.classes.findById(enrollment.courseClassId);
        if (!courseClass) {
            return {
                enrollmentId: enrollment.id,
                courseName: 'N/A',
                studentName: 'N/A',
                status: 'error',
                reason: 'Turma não encontrada'
            };
        }

        const course = await this.courses.findById(courseClass.courseId);
        if (!course) {
            return {
                enrollmentId: enrollment.id,
                courseName: 'N/A',
                studentName: 'N/A',
                status: 'error',
                reason: 'Curso não encontrado'
            };
        }

        // Verificar se o curso tem preço mensal
        const monthlyPrice = enrollment.fullAmountCents ?? course.monthlyPriceCents;
        if (!monthlyPrice || monthlyPrice <= 0) {
            return {
                enrollmentId: enrollment.id,
                courseName: course.name,
                studentName: 'N/A',
                status: 'skipped',
                reason: 'Curso não tem preço mensal definido'
            };
        }

        // Verificar se já existe cobrança para este mês
        if (!this.charges.findTuitionChargesForMonth) {
            return {
                enrollmentId: enrollment.id,
                courseName: course.name,
                studentName: 'N/A',
                status: 'error',
                reason: 'Repositório não suporta busca por mês'
            };
        }

        // Calcular data de vencimento baseada no paymentDueDay do enrollment
        const dueDay = enrollment.paymentDueDay; // Dia do mês que vence (1-31)
        
        // Calcular mês/ano de vencimento
        // Se hoje é o dia de gerar (10 dias antes), a cobrança vence no próximo mês
        let dueMonth = currentMonth + 1;
        let dueYear = currentYear;
        if (dueMonth > 12) {
            dueMonth = 1;
            dueYear = currentYear + 1;
        }
        
        // Ajustar se o dia de vencimento não existe no mês (ex: 31 em fevereiro)
        const daysInMonth = new Date(dueYear, dueMonth, 0).getDate();
        const adjustedDueDay = Math.min(dueDay, daysInMonth);
        
        const dueDate = new Date(dueYear, dueMonth - 1, adjustedDueDay); // setMonth usa 0-11

        // Verificar se já existe cobrança para este mês/ano de vencimento
        const existingCharges = await this.charges.findTuitionChargesForMonth(
            enrollment.courseClassId,
            enrollment.ownerUserId,
            enrollment.studentUserId,
            enrollment.dependentId,
            dueYear,
            dueMonth
        );

        if (existingCharges.length > 0) {
            return {
                enrollmentId: enrollment.id,
                courseName: course.name,
                studentName: 'N/A',
                status: 'skipped',
                reason: `Já existe ${existingCharges.length} cobrança(s) para ${dueMonth}/${dueYear}`
            };
        }

        // Buscar enrollment request original para obter informações de desconto
        let discountCents: number | null = null;
        let discountMonths: number | null = null;
        if (this.enrollmentRequests) {
            const request = await this.enrollmentRequests.findByCourseClassAndTarget({
                courseClassId: enrollment.courseClassId,
                userId: enrollment.ownerUserId,
                dependentId: enrollment.dependentId
            });
            if (request && request.status === 'APPROVED') {
                discountCents = request.discountCents;
                discountMonths = request.discountMonths;
            }
        }

        // Aplicar desconto se houver e se ainda não atingiu o limite de meses
        let chargeDiscountCents: number | null = null;
        let chargeDiscountReason: string | null = null;
        if (discountCents && discountCents > 0 && discountMonths && discountMonths >= 1) {
            // Contar quantas cobranças com desconto já foram criadas para este enrollment
            const existingDiscountCount = this.charges.countChargesWithDiscount
                ? await this.charges.countChargesWithDiscount(
                    enrollment.courseClassId,
                    enrollment.ownerUserId,
                    enrollment.studentUserId,
                    enrollment.dependentId
                )
                : 0;

            // Aplicar desconto apenas se ainda não atingiu o limite
            if (existingDiscountCount < discountMonths) {
                chargeDiscountCents = discountCents;
                const remainingMonths = discountMonths - existingDiscountCount;
                chargeDiscountReason = `Desconto aplicado (${remainingMonths} de ${discountMonths} ${discountMonths === 1 ? 'mês' : 'meses'})`;
            }
        }

        // Criar cobrança
        const monthNames = [
            'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
            'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
        ];
        const monthName = monthNames[dueMonth - 1];

        const charge = SchoolFinancialCharge.create({
            id: Uuid(),
            schoolId: course.schoolId,
            ownerUserId: enrollment.ownerUserId,
            studentUserId: enrollment.studentUserId,
            dependentId: enrollment.dependentId,
            courseId: course.id,
            courseClassId: enrollment.courseClassId,
            chargeType: 'TUITION',
            description: `Mensalidade - ${monthName} ${dueYear}`,
            amountCents: monthlyPrice,
            discountCents: chargeDiscountCents,
            discountReason: chargeDiscountReason,
            dueDate
        });

        await this.charges.save(charge);

        return {
            enrollmentId: enrollment.id,
            courseName: course.name,
            studentName: 'N/A',
            status: 'generated',
            reason: `Cobrança criada para ${monthName}/${dueYear} (vencimento: dia ${adjustedDueDay})`
        };
    }
}

