import type { SchoolFinancialChargeRepository } from '../../ports/repositories/school-financial-charge.repo';
import type { SchoolPlanInvoiceRepository } from '../../ports/repositories/school-plan-invoice.repo';
import type { ChargeDueReminderRepository } from '../../ports/repositories/charge-due-reminder.repo';
import type { OutboxRepository } from '../../ports/repositories/outbox.repo';
import type { UserRepository } from '../../ports/repositories/user.repo';
import type { SchoolRepository } from '../../ports/repositories/school.repo';
import type { CourseRepository } from '../../ports/repositories/course.repo';
import type { NotifyStudentUser } from './notify-student-user';

const OPEN_CHARGE_STATUSES = ['PENDING_SYNC', 'OPEN', 'OVERDUE'] as const;
const DUE_REMINDER_DAYS = 10;
const JOB_TYPE = 'send_charge_due_reminder_email';

function formatCurrency(cents: number, currency: string = 'BRL'): string {
    const value = cents / 100;
    if (currency === 'BRL') {
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
    }
    return `${currency} ${value.toFixed(2)}`;
}

function formatDate(date: Date): string {
    return new Intl.DateTimeFormat('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    }).format(date);
}

export type ScheduleChargeDueRemindersInput = void;

export type ScheduleChargeDueRemindersOutput = {
    chargesEnqueued: number;
    invoicesEnqueued: number;
    errors: number;
};

export class ScheduleChargeDueReminders {
    constructor(
        private readonly chargeRepo: SchoolFinancialChargeRepository,
        private readonly invoiceRepo: SchoolPlanInvoiceRepository,
        private readonly reminderRepo: ChargeDueReminderRepository,
        private readonly outbox: OutboxRepository,
        private readonly userRepo: UserRepository,
        private readonly schoolRepo: SchoolRepository,
        private readonly courseRepo: CourseRepository,
        private readonly notifyStudent?: NotifyStudentUser
    ) {}

    async exec(_input: ScheduleChargeDueRemindersInput): Promise<ScheduleChargeDueRemindersOutput> {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const endDate = new Date(today);
        endDate.setDate(endDate.getDate() + DUE_REMINDER_DAYS);
        endDate.setHours(23, 59, 59, 999);

        let chargesEnqueued = 0;
        let invoicesEnqueued = 0;
        let errors = 0;

        if (!this.chargeRepo.findByDateRange) {
            // skip charges if repo doesn't support date range
        } else {
            const charges = await this.chargeRepo.findByDateRange(today, endDate);
            const openChargesWithUrl = charges.filter(
                (c) =>
                    OPEN_CHARGE_STATUSES.includes(c.status as (typeof OPEN_CHARGE_STATUSES)[number]) &&
                    c.asaasInvoiceUrl
            );

            for (const charge of openChargesWithUrl) {
                try {
                    const sent = await this.reminderRepo.wasReminderSent('SCHOOL_FINANCIAL_CHARGE', charge.id);
                    if (sent) continue;

                    const owner = await this.userRepo.findById(charge.ownerUserId);
                    if (!owner?.email) continue;

                    const course = await this.courseRepo.findById(charge.courseId);
                    const courseName = course?.name ?? undefined;
                    const chargeType =
                        charge.chargeType === 'TUITION'
                            ? 'tuition'
                            : charge.chargeType === 'ENROLLMENT'
                              ? 'enrollment'
                              : 'tuition';

                    await this.reminderRepo.markReminderSent('SCHOOL_FINANCIAL_CHARGE', charge.id);
                    await this.outbox.enqueue({
                        type: JOB_TYPE,
                        aggregateId: charge.id,
                        payload: {
                            to: owner.email.value,
                            recipientName: owner.fullName,
                            description: charge.description || (chargeType === 'tuition' ? 'Mensalidade' : 'Taxa de matrícula'),
                            amount: formatCurrency(charge.netAmountCents, 'BRL'),
                            dueDate: formatDate(charge.dueDate),
                            type: chargeType,
                            courseName: courseName ?? undefined,
                            boletoUrl: charge.asaasInvoiceUrl ?? undefined
                        }
                    });

                    if (charge.chargeType === 'TUITION' && this.notifyStudent) {
                        const school = await this.schoolRepo.findById(charge.schoolId);
                        const title = 'Mensalidade a vencer';
                        const desc = charge.description || 'Mensalidade';
                        const message = school
                            ? `${desc} — ${formatCurrency(charge.netAmountCents, 'BRL')} vence em ${formatDate(charge.dueDate)} (${school.name}).`
                            : `${desc} — ${formatCurrency(charge.netAmountCents, 'BRL')} vence em ${formatDate(charge.dueDate)}.`;
                        try {
                            await this.notifyStudent.exec({
                                userId: charge.ownerUserId,
                                schoolId: charge.schoolId,
                                title,
                                message,
                                kind: 'TUITION_DUE_REMINDER',
                                sendPush: true,
                                extraMetadata: {
                                    chargeId: charge.id,
                                    courseId: charge.courseId
                                }
                            });
                        } catch {
                            errors++;
                        }
                    }

                    chargesEnqueued++;
                } catch {
                    errors++;
                }
            }
        }

        const invoices = await this.invoiceRepo.findIssuedByDueDateRange(today, endDate);
        for (const invoice of invoices) {
            try {
                const sent = await this.reminderRepo.wasReminderSent('SCHOOL_PLAN_INVOICE', invoice.id);
                if (sent) continue;

                const school = await this.schoolRepo.findById(invoice.schoolId);
                if (!school?.email) continue;

                await this.reminderRepo.markReminderSent('SCHOOL_PLAN_INVOICE', invoice.id);
                await this.outbox.enqueue({
                    type: JOB_TYPE,
                    aggregateId: invoice.id,
                    payload: {
                        to: school.email,
                        recipientName: school.name,
                        description: invoice.description || 'Assinatura plano',
                        amount: formatCurrency(invoice.amountCents, invoice.currency),
                        dueDate: formatDate(invoice.dueDate),
                        type: 'plan',
                        boletoUrl: invoice.boletoUrl ?? undefined
                    }
                });
                invoicesEnqueued++;
            } catch {
                errors++;
            }
        }

        return { chargesEnqueued, invoicesEnqueued, errors };
    }
}
