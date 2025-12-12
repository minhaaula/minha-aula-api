import { EnrollmentRepository } from '../../ports/repositories/enrollment.repo';
import { SchoolFinancialChargeRepository } from '../../ports/repositories/school-financial-charge.repo';
import { CourseRepository } from '../../ports/repositories/course.repo';
import { CourseClassRepository } from '../../ports/repositories/course-class.repo';
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
        private readonly classes: CourseClassRepository
    ) {}

    async exec(input: GenerateMonthlyTuitionChargesInput = {}): Promise<GenerateMonthlyTuitionChargesOutput> {
        const now = new Date();
        const targetMonth = input.targetMonth ?? (now.getMonth() + 2); // Próximo mês (0-indexed + 2)
        const targetYear = input.targetYear ?? (targetMonth > 12 ? now.getFullYear() + 1 : now.getFullYear());
        const normalizedMonth = targetMonth > 12 ? targetMonth - 12 : targetMonth;

        log.info('[GenerateMonthlyTuitionCharges] Iniciando geração de cobranças mensais', {
            targetMonth: normalizedMonth,
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
                    fullAmountCents: row.fullAmountCents
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
                fullAmountCents: row.fullAmountCents
            });
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

        for (const enrollment of activeEnrollments) {
            try {
                const detail = await this.processEnrollment(enrollment, normalizedMonth, targetYear);
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
        targetMonth: number,
        targetYear: number
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

        const existingCharges = await this.charges.findTuitionChargesForMonth(
            enrollment.courseClassId,
            enrollment.ownerUserId,
            enrollment.studentUserId,
            enrollment.dependentId,
            targetYear,
            targetMonth
        );

        if (existingCharges.length > 0) {
            return {
                enrollmentId: enrollment.id,
                courseName: course.name,
                studentName: 'N/A',
                status: 'skipped',
                reason: `Já existe ${existingCharges.length} cobrança(s) para ${targetMonth}/${targetYear}`
            };
        }

        // Buscar última cobrança para calcular data de vencimento
        let dueDate: Date;
        if (this.charges.findLastTuitionCharge) {
            const lastCharge = await this.charges.findLastTuitionCharge(
                enrollment.id,
                enrollment.courseClassId,
                enrollment.ownerUserId,
                enrollment.studentUserId,
                enrollment.dependentId
            );

            if (lastCharge) {
                // Calcular próximo mês a partir da última cobrança
                dueDate = new Date(lastCharge.dueDate);
                dueDate.setMonth(dueDate.getMonth() + 1);
            } else {
                // Se não há última cobrança, usar data de matrícula + 1 mês
                dueDate = new Date(enrollment.enrolledAt);
                dueDate.setMonth(dueDate.getMonth() + 1);
            }
        } else {
            // Fallback: usar data de matrícula + 1 mês
            dueDate = new Date(enrollment.enrolledAt);
            dueDate.setMonth(dueDate.getMonth() + 1);
        }

        // Ajustar para o mês/ano alvo
        dueDate.setFullYear(targetYear);
        dueDate.setMonth(targetMonth - 1); // setMonth usa 0-11
        dueDate.setDate(10); // Dia 10 de cada mês

        // Criar cobrança
        const monthNames = [
            'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
            'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
        ];
        const monthName = monthNames[targetMonth - 1];

        const charge = SchoolFinancialCharge.create({
            id: Uuid(),
            schoolId: course.schoolId,
            ownerUserId: enrollment.ownerUserId,
            studentUserId: enrollment.studentUserId,
            dependentId: enrollment.dependentId,
            courseId: course.id,
            courseClassId: enrollment.courseClassId,
            chargeType: 'TUITION',
            description: `Mensalidade - ${monthName} ${targetYear}`,
            amountCents: monthlyPrice,
            discountCents: null,
            discountReason: null,
            dueDate
        });

        await this.charges.save(charge);

        return {
            enrollmentId: enrollment.id,
            courseName: course.name,
            studentName: 'N/A',
            status: 'generated',
            reason: `Cobrança criada para ${monthName}/${targetYear}`
        };
    }
}

