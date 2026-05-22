import { EnrollmentRepository } from "../../../ports/repositories/enrollment.repo";
import { SchoolFinancialChargeRepository } from "../../../ports/repositories/school-financial-charge.repo";
import { CourseRepository } from "../../../ports/repositories/course.repo";
import { CourseClassRepository } from "../../../ports/repositories/course-class.repo";
import { EnrollmentRequestRepository } from "../../../ports/repositories/enrollment-request.repo";
import { SchoolFinancialCharge } from "../../../domain/entities/school-financial-charge";
import { Uuid } from "../../../shared/uuid";
import { log } from "../../../shared/logger";
import type { NotifyStudentUser } from "../shared/notify-student-user";
import { AppDataSource } from "../../../infra/db/typeorm/datasource";
import { EnrollmentOrm } from "../../../infra/db/typeorm/entities/enrollment.orm";
import { Enrollment } from "../../../domain/entities/enrollment";

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
    status: "generated" | "skipped" | "error";
    reason?: string;
  }>;
};

function formatCurrency(cents: number, currency: string = "BRL"): string {
  const value = cents / 100;
  if (currency === "BRL") {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  }
  return `${currency} ${value.toFixed(2)}`;
}

function formatDateBr(date: Date): string {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

export class GenerateMonthlyTuitionCharges {
  /** Inclui até 31 dias antes do vencimento (ex.: maio→junho). */
  private static readonly DAYS_BEFORE_DUE_TO_GENERATE = 10;

  constructor(
    private readonly enrollments: EnrollmentRepository,
    private readonly charges: SchoolFinancialChargeRepository,
    private readonly courses: CourseRepository,
    private readonly classes: CourseClassRepository,
    private readonly enrollmentRequests:
      | EnrollmentRequestRepository
      | undefined,
    private readonly notifyStudent?: NotifyStudentUser,
  ) {}

  async exec(
    input: GenerateMonthlyTuitionChargesInput = {},
  ): Promise<GenerateMonthlyTuitionChargesOutput> {
    const now = new Date();
    const currentDay = now.getDate();
    const currentMonth = now.getMonth() + 1; // 1-12
    const currentYear = now.getFullYear();
    const todayStart = new Date(currentYear, currentMonth - 1, currentDay);
    todayStart.setHours(0, 0, 0, 0);

    // Se não especificado, mês-alvo é sempre o próximo mês (janela de geração vem do filtro por dias até o vencimento).
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

    log.info(
      "[GenerateMonthlyTuitionCharges] Iniciando geração de cobranças mensais",
      {
        currentDay,
        currentMonth,
        currentYear,
        targetMonth,
        targetYear,
      },
    );

    // Buscar todas as matrículas ativas usando query direta no banco
    const repo = AppDataSource.getRepository(EnrollmentOrm);
    const enrollmentRows = await repo.find({
      where: { status: "ACTIVE" },
    });

    const activeEnrollments: Enrollment[] = enrollmentRows.map((row) => {
      if (row.studentType === "USER") {
        return Enrollment.createForUser({
          id: row.id,
          courseClassId: row.courseClassId,
          ownerUserId: row.ownerUserId,
          studentUserId: row.studentUserId!,
          status: row.status as any,
          enrolledAt: row.enrolledAt,
          updatedAt: row.updatedAt,
          fullAmountCents: row.fullAmountCents,
          paymentDueDay: row.paymentDueDay,
          tuitionExemptionType: row.tuitionExemptionType,
          currentSchoolStudentLevelId: row.currentSchoolStudentLevelId,
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
        paymentDueDay: row.paymentDueDay,
        tuitionExemptionType: row.tuitionExemptionType,
        currentSchoolStudentLevelId: row.currentSchoolStudentLevelId,
      });
    });

    // Filtrar apenas enrollments que devem ter cobrança gerada hoje
    // Lógica: gerar quando faltar X dias (ou menos) para o vencimento do PRÓXIMO MÊS (padrão: 31).
    // Como o cron roda a cada 5 minutos, a idempotência é garantida por `findTuitionChargesForMonth`.
    const enrollmentsToProcess = activeEnrollments.filter((enrollment) => {
      const dueDay = enrollment.paymentDueDay; // 1-31

      // A cobrança vence no próximo mês
      let dueMonth = currentMonth + 1;
      let dueYear = currentYear;
      if (dueMonth > 12) {
        dueMonth = 1;
        dueYear = currentYear + 1;
      }

      // Ajustar vencimento para meses com menos dias (ex.: 31 em fevereiro)
      const daysInDueMonth = new Date(dueYear, dueMonth, 0).getDate();
      const adjustedDueDay = Math.min(dueDay, daysInDueMonth);
      const dueDate = new Date(dueYear, dueMonth - 1, adjustedDueDay);
      dueDate.setHours(0, 0, 0, 0);

      const diffMs = dueDate.getTime() - todayStart.getTime();
      const diffDays = Math.floor(diffMs / (24 * 60 * 60 * 1000));

      // Processar se o vencimento está dentro da janela [0, X] dias.
      return (
        diffDays >= 0 &&
        diffDays <= GenerateMonthlyTuitionCharges.DAYS_BEFORE_DUE_TO_GENERATE
      );
    });

    log.info(
      "[GenerateMonthlyTuitionCharges] Matrículas filtradas para processamento",
      {
        total: activeEnrollments.length,
        toProcess: enrollmentsToProcess.length,
        currentDay,
      },
    );

    log.info("[GenerateMonthlyTuitionCharges] Matrículas ativas encontradas", {
      count: activeEnrollments.length,
    });

    const result: GenerateMonthlyTuitionChargesOutput = {
      generated: 0,
      skipped: 0,
      errors: 0,
      details: [],
    };

    for (const enrollment of enrollmentsToProcess) {
      try {
        const detail = await this.processEnrollment(
          enrollment,
          currentMonth,
          currentYear,
        );
        result.details.push(detail);

        if (detail.status === "generated") {
          result.generated++;
        } else if (detail.status === "skipped") {
          result.skipped++;
        } else {
          result.errors++;
        }
      } catch (error) {
        result.errors++;
        result.details.push({
          enrollmentId: enrollment.id,
          courseName: "N/A",
          studentName: "N/A",
          status: "error",
          reason: error instanceof Error ? error.message : "Erro desconhecido",
        });
        log.error(
          "[GenerateMonthlyTuitionCharges] Erro ao processar matrícula",
          {
            enrollmentId: enrollment.id,
            error: error instanceof Error ? error.message : String(error),
          },
        );
      }
    }

    log.info("[GenerateMonthlyTuitionCharges] Processamento concluído", {
      generated: result.generated,
      skipped: result.skipped,
      errors: result.errors,
    });

    return result;
  }

  private async processEnrollment(
    enrollment: import('../../../domain/entities/enrollment').Enrollment,
    currentMonth: number,
    currentYear: number,
  ): Promise<GenerateMonthlyTuitionChargesOutput["details"][0]> {
    // Buscar dados do curso e turma
    const courseClass = await this.classes.findById(enrollment.courseClassId);
    if (!courseClass) {
      return {
        enrollmentId: enrollment.id,
        courseName: "N/A",
        studentName: "N/A",
        status: "error",
        reason: "Turma não encontrada",
      };
    }

    const course = await this.courses.findById(courseClass.courseId);
    if (!course) {
      return {
        enrollmentId: enrollment.id,
        courseName: "N/A",
        studentName: "N/A",
        status: "error",
        reason: "Curso não encontrado",
      };
    }

    if (enrollment.isTuitionExempt) {
      return {
        enrollmentId: enrollment.id,
        courseName: course.name,
        studentName: "N/A",
        status: "skipped",
        reason: "Aluno isento de mensalidade",
      };
    }

    // Verificar se o curso tem preço mensal
    const monthlyPrice = enrollment.fullAmountCents ?? course.monthlyPriceCents;
    if (!monthlyPrice || monthlyPrice <= 0) {
      return {
        enrollmentId: enrollment.id,
        courseName: course.name,
        studentName: "N/A",
        status: "skipped",
        reason: "Curso não tem preço mensal definido",
      };
    }

    // Verificar se já existe cobrança para este mês
    if (!this.charges.findTuitionChargesForMonth) {
      return {
        enrollmentId: enrollment.id,
        courseName: course.name,
        studentName: "N/A",
        status: "error",
        reason: "Repositório não suporta busca por mês",
      };
    }

    // Calcular data de vencimento baseada no paymentDueDay do enrollment
    const dueDay = enrollment.paymentDueDay; // Dia do mês que vence (1-31)

    // Calcular mês/ano de vencimento
    // A cobrança vence no próximo mês (mês-alvo da geração)
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
      dueMonth,
    );

    if (existingCharges.length > 0) {
      return {
        enrollmentId: enrollment.id,
        courseName: course.name,
        studentName: "N/A",
        status: "skipped",
        reason: `Já existe ${existingCharges.length} cobrança(s) para ${dueMonth}/${dueYear}`,
      };
    }

    // Buscar enrollment request original para obter informações de desconto
    let discountCents: number | null = null;
    let discountMonths: number | null = null;
    if (this.enrollmentRequests) {
      const request = await this.enrollmentRequests.findByCourseClassAndTarget({
        courseClassId: enrollment.courseClassId,
        userId: enrollment.ownerUserId,
        dependentId: enrollment.dependentId,
      });
      if (request && request.status === "APPROVED") {
        discountCents = request.discountCents;
        discountMonths = request.discountMonths;
      }
    }

    // Aplicar desconto se houver e se ainda não atingiu o limite de meses
    let chargeDiscountCents: number | null = null;
    let chargeDiscountReason: string | null = null;
    if (
      discountCents &&
      discountCents > 0 &&
      discountMonths &&
      discountMonths >= 1
    ) {
      // Contar quantas cobranças com desconto já foram criadas para este enrollment
      const existingDiscountCount = this.charges.countChargesWithDiscount
        ? await this.charges.countChargesWithDiscount(
            enrollment.courseClassId,
            enrollment.ownerUserId,
            enrollment.studentUserId,
            enrollment.dependentId,
          )
        : 0;

      // Aplicar desconto apenas se ainda não atingiu o limite
      if (existingDiscountCount < discountMonths) {
        chargeDiscountCents = discountCents;
        const remainingMonths = discountMonths - existingDiscountCount;
        const currentDiscountIndex = existingDiscountCount + 1;
        chargeDiscountReason = `Desconto aplicado (${currentDiscountIndex} de ${discountMonths} ${discountMonths === 1 ? "mês" : "meses"})`;
      }
    }

    // Criar cobrança
    const monthNames = [
      "Janeiro",
      "Fevereiro",
      "Março",
      "Abril",
      "Maio",
      "Junho",
      "Julho",
      "Agosto",
      "Setembro",
      "Outubro",
      "Novembro",
      "Dezembro",
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
      chargeType: "TUITION",
      description: `Mensalidade - ${monthName} ${dueYear}`,
      amountCents: monthlyPrice,
      discountCents: chargeDiscountCents,
      discountReason: chargeDiscountReason,
      dueDate,
    });

    await this.charges.save(charge);

    if (this.notifyStudent) {
      try {
        const desc = charge.description || "Mensalidade";
        const messageBase = `${desc} — ${formatCurrency(charge.netAmountCents, "BRL")} · vencimento ${formatDateBr(charge.dueDate)}. Abra o app para gerar o pagamento.`;
        const message = `${messageBase} (${course.name}).`;
        await this.notifyStudent.exec({
          userId: enrollment.ownerUserId,
          schoolId: charge.schoolId,
          title: "Nova mensalidade",
          message,
          kind: "TUITION_CHARGE_CREATED",
          sendPush: true,
          extraMetadata: {
            chargeId: charge.id,
            courseId: charge.courseId,
            courseClassId: enrollment.courseClassId,
          },
        });
      } catch (err) {
        log.warn(
          "[GenerateMonthlyTuitionCharges] Falha ao notificar nova mensalidade (in-app/push)",
          {
            chargeId: charge.id,
            error: err instanceof Error ? err.message : String(err),
          },
        );
      }
    }

    return {
      enrollmentId: enrollment.id,
      courseName: course.name,
      studentName: "N/A",
      status: "generated",
      reason: `Cobrança criada para ${monthName}/${dueYear} (vencimento: dia ${adjustedDueDay})`,
    };
  }
}
