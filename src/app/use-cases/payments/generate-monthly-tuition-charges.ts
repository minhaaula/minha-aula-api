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
import { coerceToDate } from "../../../shared/date-utils";
import {
  isTuitionDueOnOrAfterFirstPayment,
  resolveFirstTuitionPaymentDueDate,
} from "./resolve-first-tuition-payment-due-date";
import {
  resolveNextTuitionDueDate,
  shouldGenerateTuitionChargeInWindow,
} from "./resolve-next-tuition-due-date";
import { coerceToDate } from "../../../shared/date-utils";

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
  /** Gera se faltam até N dias para o próximo vencimento (pode ser no mês atual). */
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
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();

    log.info(
      "[GenerateMonthlyTuitionCharges] Iniciando geração de cobranças mensais",
      {
        currentDay,
        currentMonth,
        currentYear,
        daysBeforeDue: GenerateMonthlyTuitionCharges.DAYS_BEFORE_DUE_TO_GENERATE,
        targetMonth: input.targetMonth,
        targetYear: input.targetYear,
      },
    );

    // Buscar todas as matrículas ativas usando query direta no banco
    const repo = AppDataSource.getRepository(EnrollmentOrm);
    const enrollmentRows = await repo.find({
      where: { status: "ACTIVE" },
    });

    const activeEnrollments: Enrollment[] = enrollmentRows.map((row) => {
      const enrolledAt = coerceToDate(row.enrolledAt) ?? new Date();
      const updatedAt = coerceToDate(row.updatedAt) ?? enrolledAt;
      if (row.studentType === "USER") {
        return Enrollment.createForUser({
          id: row.id,
          courseClassId: row.courseClassId,
          ownerUserId: row.ownerUserId,
          studentUserId: row.studentUserId!,
          status: row.status as any,
          enrolledAt,
          updatedAt,
          fullAmountCents: row.fullAmountCents,
          paymentDueDay: row.paymentDueDay,
          tuitionExemptionType: row.tuitionExemptionType,
          discountCents: row.discountCents ?? null,
          discountMonths: row.discountMonths ?? null,
          currentSchoolStudentLevelId: row.currentSchoolStudentLevelId,
        });
      }
      return Enrollment.createForDependent({
        id: row.id,
        courseClassId: row.courseClassId,
        ownerUserId: row.ownerUserId,
        dependentId: row.dependentId!,
        status: row.status as any,
        enrolledAt,
        updatedAt,
        fullAmountCents: row.fullAmountCents,
        paymentDueDay: row.paymentDueDay,
        tuitionExemptionType: row.tuitionExemptionType,
        discountCents: row.discountCents ?? null,
        discountMonths: row.discountMonths ?? null,
        currentSchoolStudentLevelId: row.currentSchoolStudentLevelId,
      });
    });

    // Janela: 0–N dias antes do próximo vencimento (mês atual ou seguinte). Idempotência: findTuitionChargesForMonth.
    const enrollmentsToProcess = activeEnrollments.filter((enrollment) =>
      shouldGenerateTuitionChargeInWindow(
        now,
        enrollment.paymentDueDay,
        GenerateMonthlyTuitionCharges.DAYS_BEFORE_DUE_TO_GENERATE,
      ),
    );

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
        const detail = await this.processEnrollment(enrollment, now, input);
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
    referenceDate: Date,
    input: GenerateMonthlyTuitionChargesInput,
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

    const { dueDate, dueYear, dueMonth, adjustedDueDay } =
      input.targetMonth && input.targetYear
        ? (() => {
            const monthIndex = input.targetMonth! - 1;
            const year = input.targetYear!;
            const day = enrollment.paymentDueDay;
            const daysInMonth = new Date(year, input.targetMonth!, 0).getDate();
            const adjusted = Math.min(day, daysInMonth);
            const date = new Date(year, monthIndex, adjusted);
            date.setHours(0, 0, 0, 0);
            return {
              dueDate: date,
              dueYear: year,
              dueMonth: input.targetMonth!,
              adjustedDueDay: adjusted,
            };
          })()
        : resolveNextTuitionDueDate(referenceDate, enrollment.paymentDueDay);

    const request =
      this.enrollmentRequests
        ? await this.enrollmentRequests.findByCourseClassAndTarget({
            courseClassId: enrollment.courseClassId,
            userId: enrollment.ownerUserId,
            dependentId: enrollment.dependentId,
          })
        : null;

    const earliestCharge =
      this.charges.findEarliestTuitionCharge
        ? await this.charges.findEarliestTuitionCharge(
            enrollment.courseClassId,
            enrollment.ownerUserId,
            enrollment.studentUserId,
            enrollment.dependentId,
          )
        : null;

    const firstPaymentDueDate = resolveFirstTuitionPaymentDueDate({
      enrolledAt: enrollment.enrolledAt,
      paymentDueDay: enrollment.paymentDueDay,
      requestFirstMonthlyPaymentDate:
        request?.status === "APPROVED" ? request.firstMonthlyPaymentDate : null,
      earliestTuitionChargeDueDate: earliestCharge?.dueDate ?? null,
    });

    if (!isTuitionDueOnOrAfterFirstPayment(dueDate, firstPaymentDueDate)) {
      return {
        enrollmentId: enrollment.id,
        courseName: course.name,
        studentName: "N/A",
        status: "skipped",
        reason: `Cobrança não gerada antes da primeira mensalidade (vencimento mínimo: ${formatDateBr(firstPaymentDueDate)})`,
      };
    }

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

    let discountCents = enrollment.discountCents;
    let discountMonths = enrollment.discountMonths;
    if ((discountCents === null || discountMonths === null) && request?.status === "APPROVED") {
      discountCents = discountCents ?? request.discountCents;
      discountMonths = discountMonths ?? request.discountMonths;
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
