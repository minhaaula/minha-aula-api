/**
 * Gerenciador do Worker BullMQ
 * Inicializa e gerencia o worker que processa jobs da fila
 */

import { Worker } from 'bullmq';
import { AppDataSource } from '../../db/typeorm/datasource';
import { PushTokenRepositoryAdapter } from '../../db/typeorm/push-token-repository.adapter';
import { sendFcmMulticast } from '../../providers/firebase/fcm-provider';
import { log } from '../../../shared/logger';

const connection = {
    host: process.env.REDIS_HOST,
    port: +(process.env.REDIS_PORT ?? 6379),
    ...(process.env.REDIS_USER ? { username: process.env.REDIS_USER } : {}),
    ...(process.env.REDIS_PASSWORD ? { password: process.env.REDIS_PASSWORD } : {}),
};

type OutboxEvent = { type: string; payload: any; aggregateId: string };

let workerInstance: Worker | null = null;

async function ensureDb() {
    if (!AppDataSource.isInitialized) {
        await AppDataSource.initialize();
    }
}

function chunk<T>(arr: T[], size: number): T[][] {
    const out: T[][] = [];
    for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
    return out;
}

/**
 * Inicializa o worker BullMQ para processar jobs da fila
 */
export function startWorker(): Worker {
    if (workerInstance) {
        log.warn('[Worker Manager] Worker já está em execução');
        return workerInstance;
    }

    if (!process.env.REDIS_HOST) {
        log.warn('[Worker Manager] REDIS_HOST não configurado. Worker não será iniciado.');
        throw new Error('REDIS_HOST não configurado');
    }

    log.info('[Worker Manager] Iniciando worker BullMQ...');

    workerInstance = new Worker(
        'outbox',
        async (job) => {
            const event = job.data as OutboxEvent;
            // Log detalhado para diagnóstico
            log.info('[OUTBOX] Processando job', { 
                name: job.name, 
                id: job.id,
                aggregateId: event?.aggregateId,
                type: event?.type,
                payload: event?.payload,
                opts: job.opts
            });

            // Verificar também pelo tipo do evento (fallback)
            const jobType = event?.type || job.name;

            if (job.name === 'push_notification' || jobType === 'push_notification') {
                await ensureDb();
                const tokensRepo = new PushTokenRepositoryAdapter();

                const userIds = Array.isArray(event.payload?.userIds) ? event.payload.userIds : [];
                const title = String(event.payload?.title ?? '').trim();
                const body = String(event.payload?.body ?? '').trim();
                const data = event.payload?.data && typeof event.payload.data === 'object' ? event.payload.data : undefined;
                if (!userIds.length || !title || !body) {
                    log.warn('[OUTBOX] push_notification payload inválido', { userIdsCount: userIds.length, hasTitle: !!title, hasBody: !!body });
                    return;
                }

                const active = await tokensRepo.listActiveByUserIds(userIds);
                const tokens = active.map((t) => t.token);
                if (!tokens.length) {
                    log.info('[OUTBOX] push_notification: sem tokens', { userIds: userIds.length });
                    return;
                }

                // FCM suporta até 500 tokens por multicast
                const invalid: string[] = [];
                let successCount = 0;
                let failureCount = 0;
                for (const group of chunk(tokens, 500)) {
                    const res = await sendFcmMulticast({ tokens: group, title, body, data });
                    successCount += res.successCount;
                    failureCount += res.failureCount;
                    invalid.push(...res.invalidTokens);
                }

                if (invalid.length) {
                    await tokensRepo.revokeByTokens(invalid);
                }

                log.info('[OUTBOX] push_notification sent', { successCount, failureCount, invalid: invalid.length });
                return;
            }

            if (job.name === 'fetch_payment_receipts' || jobType === 'fetch_payment_receipts') {
                log.info('[OUTBOX] Iniciando processamento de fetch_payment_receipts');
                await ensureDb();
                
                const { SchoolPlanInvoiceRepositoryAdapter } = await import('../../db/typeorm/school-plan-invoice-repository.adapter.js');
                const { SchoolPlanFinanceRepositoryAdapter } = await import('../../db/typeorm/school-plan-finance-repository.adapter.js');
                const { SchoolRepositoryAdapter } = await import('../../db/typeorm/school-repository.js');
                const { AsaasProvider } = await import('../../providers/asaas/asaas-provider.js');
                const { FetchPaymentReceipts } = await import('../../../app/use-cases/fetch-payment-receipts.js');

                const invoicesRepo = new SchoolPlanInvoiceRepositoryAdapter();
                const financesRepo = new SchoolPlanFinanceRepositoryAdapter();
                const schoolsRepo = new SchoolRepositoryAdapter();

                const asaasApiKey = process.env.ASAAS_API_KEY;
                const asaasBaseUrl = process.env.ASAAS_BASE_URL;
                const asaasProviderInstance = asaasApiKey ? new AsaasProvider({ apiKey: asaasApiKey, baseUrl: asaasBaseUrl }) : undefined;
                const asaasProvider = asaasProviderInstance && typeof asaasProviderInstance.getPayment === 'function'
                    ? asaasProviderInstance as any
                    : undefined;

                const { OutboxProducer } = await import('./outbox-producer.js');
                const outbox = new OutboxProducer();
                const fetchReceipts = new FetchPaymentReceipts(
                    invoicesRepo,
                    financesRepo,
                    schoolsRepo,
                    asaasProvider,
                    outbox
                );

                const limit = typeof event.payload?.limit === 'number' ? event.payload.limit : 50;
                const result = await fetchReceipts.exec({ limit });

                log.info('[OUTBOX] fetch_payment_receipts completed', result);
                return;
            }

            if (job.name === 'sync_payment_status' || jobType === 'sync_payment_status') {
                log.info('[OUTBOX] Iniciando processamento de sync_payment_status');
                await ensureDb();
                
                const { SchoolPlanInvoiceRepositoryAdapter } = await import('../../db/typeorm/school-plan-invoice-repository.adapter.js');
                const { SchoolPlanFinanceRepositoryAdapter } = await import('../../db/typeorm/school-plan-finance-repository.adapter.js');
                const { SchoolRepositoryAdapter } = await import('../../db/typeorm/school-repository.js');
                const { AsaasProvider } = await import('../../providers/asaas/asaas-provider.js');
                const { SyncPaymentStatus } = await import('../../../app/use-cases/sync-payment-status.js');

                const invoicesRepo = new SchoolPlanInvoiceRepositoryAdapter();
                const financesRepo = new SchoolPlanFinanceRepositoryAdapter();
                const schoolsRepo = new SchoolRepositoryAdapter();

                const asaasApiKey = process.env.ASAAS_API_KEY;
                const asaasBaseUrl = process.env.ASAAS_BASE_URL;
                const asaasProviderInstance = asaasApiKey ? new AsaasProvider({ apiKey: asaasApiKey, baseUrl: asaasBaseUrl }) : undefined;
                const asaasProvider = asaasProviderInstance && typeof asaasProviderInstance.getPayment === 'function'
                    ? asaasProviderInstance as any
                    : undefined;

                const { OutboxProducer } = await import('./outbox-producer.js');
                const outbox = new OutboxProducer();
                const syncStatus = new SyncPaymentStatus(
                    invoicesRepo,
                    financesRepo,
                    schoolsRepo,
                    asaasProvider,
                    outbox
                );

                const limit = typeof event.payload?.limit === 'number' ? event.payload.limit : 50;
                const daysAgo = typeof event.payload?.daysAgo === 'number' ? event.payload.daysAgo : 7;
                const result = await syncStatus.exec({ limit, daysAgo });

                log.info('[OUTBOX] sync_payment_status completed', result);
                return;
            }

            if (job.name === 'ensure_school_asaas_account' || jobType === 'ensure_school_asaas_account') {
                log.info('[OUTBOX] ensure_school_asaas_account: job recebido', {
                    jobId: job.id,
                    invoiceId: event.payload?.invoiceId,
                    aggregateId: event.aggregateId
                });
                await ensureDb();

                const invoiceId = typeof event.payload?.invoiceId === 'string' ? event.payload.invoiceId : undefined;
                if (!invoiceId) {
                    log.warn('[OUTBOX] ensure_school_asaas_account: payload.invoiceId ausente, job ignorado');
                    return;
                }

                const { SchoolPlanInvoiceRepositoryAdapter } = await import('../../db/typeorm/school-plan-invoice-repository.adapter.js');
                const { SchoolRepositoryAdapter } = await import('../../db/typeorm/school-repository.js');
                const { AsaasProvider } = await import('../../providers/asaas/asaas-provider.js');
                const { EnsureSchoolAsaasAccount } = await import('../../../app/use-cases/ensure-school-asaas-account.js');

                const invoicesRepo = new SchoolPlanInvoiceRepositoryAdapter();
                const schoolsRepo = new SchoolRepositoryAdapter();
                const asaasApiKey = process.env.ASAAS_API_KEY;
                const asaasBaseUrl = process.env.ASAAS_BASE_URL;
                const asaasProviderInstance = asaasApiKey ? new AsaasProvider({ apiKey: asaasApiKey, baseUrl: asaasBaseUrl }) : undefined;
                const asaasProvider =
                    asaasProviderInstance &&
                    typeof asaasProviderInstance.createSubAccount === 'function' &&
                    typeof asaasProviderInstance.getOnboardingUrl === 'function'
                        ? (asaasProviderInstance as unknown as import('../../../ports/providers/asaas-port').AsaasProviderPort)
                        : undefined;

                if (!asaasProvider) {
                    log.warn('[OUTBOX] ensure_school_asaas_account: Asaas não configurado (ASAAS_API_KEY ou provider sem createSubAccount/getOnboardingUrl)', { invoiceId });
                }

                try {
                    const ensureAccount = new EnsureSchoolAsaasAccount(invoicesRepo, schoolsRepo, asaasProvider);
                    const result = await ensureAccount.exec({ invoiceId });

                    log.info('[OUTBOX] ensure_school_asaas_account: use case retornou', {
                        invoiceId,
                        done: result.done,
                        hasOnboardingPending: Boolean(result.onboardingPending),
                        schoolId: result.onboardingPending?.schoolId
                    });

                    if (result.onboardingPending) {
                        const { schoolId, accountApiKey } = result.onboardingPending;
                        log.info('[OUTBOX] ensure_school_asaas_account: aguardando 15s antes de buscar onboarding URL (conforme doc Asaas)', { schoolId });
                        await new Promise((r) => setTimeout(r, 15000));

                        let onboardingUrl: string | null = null;
                        if (asaasProvider?.getOnboardingUrl) {
                            try {
                                onboardingUrl = await asaasProvider.getOnboardingUrl(accountApiKey);
                                log.info('[OUTBOX] ensure_school_asaas_account: getOnboardingUrl retornou', {
                                    schoolId,
                                    hasUrl: Boolean(onboardingUrl),
                                    urlLength: onboardingUrl?.length ?? 0
                                });
                            } catch (onbErr: unknown) {
                                log.error('[OUTBOX] ensure_school_asaas_account: erro ao buscar onboarding URL', {
                                    schoolId,
                                    error: onbErr instanceof Error ? onbErr.message : String(onbErr)
                                });
                            }
                        } else {
                            log.warn('[OUTBOX] ensure_school_asaas_account: provider sem getOnboardingUrl, onboarding URL não será salva', { schoolId });
                        }

                        if (onboardingUrl) {
                            const school = await schoolsRepo.findById(schoolId);
                            if (school) {
                                await schoolsRepo.save(school.withOnboardingUrl(onboardingUrl));
                                log.info('[OUTBOX] ensure_school_asaas_account: onboarding URL salva na escola', { schoolId });
                            } else {
                                log.warn('[OUTBOX] ensure_school_asaas_account: escola não encontrada ao salvar onboarding URL', { schoolId });
                            }
                        } else {
                            log.warn('[OUTBOX] ensure_school_asaas_account: onboarding URL vazia (job recorrente a cada 15 min tentará buscar)', { schoolId });
                        }
                    }
                    log.info('[OUTBOX] ensure_school_asaas_account completed', { invoiceId });
                } catch (err: unknown) {
                    log.error('[OUTBOX] ensure_school_asaas_account: falha ao processar job', {
                        invoiceId,
                        error: err instanceof Error ? err.message : String(err),
                        stack: err instanceof Error ? err.stack : undefined
                    });
                    throw err;
                }
                return;
            }

            if (job.name === 'fetch_school_onboarding_url' || jobType === 'fetch_school_onboarding_url') {
                log.info('[OUTBOX] fetch_school_onboarding_url: iniciando (escolas com account_api_key e sem onboarding_url)');
                await ensureDb();

                const limit = typeof event.payload?.limit === 'number' ? Math.min(event.payload.limit, 100) : 50;
                const { SchoolRepositoryAdapter } = await import('../../db/typeorm/school-repository.js');
                const { AsaasProvider } = await import('../../providers/asaas/asaas-provider.js');
                const schoolsRepo = new SchoolRepositoryAdapter();
                const findMethod = schoolsRepo.findWithAccountKeyWithoutOnboardingUrl?.bind(schoolsRepo);
                if (!findMethod) {
                    log.warn('[OUTBOX] fetch_school_onboarding_url: repositório sem findWithAccountKeyWithoutOnboardingUrl');
                    return;
                }

                const schools = await findMethod(limit);
                if (schools.length === 0) {
                    log.info('[OUTBOX] fetch_school_onboarding_url: nenhuma escola pendente de onboarding');
                    return;
                }

                const asaasApiKey = process.env.ASAAS_API_KEY;
                const asaasBaseUrl = process.env.ASAAS_BASE_URL;
                const asaasProviderInstance = asaasApiKey ? new AsaasProvider({ apiKey: asaasApiKey, baseUrl: asaasBaseUrl }) : undefined;
                const asaasProvider =
                    asaasProviderInstance &&
                    typeof asaasProviderInstance.getOnboardingUrl === 'function'
                        ? (asaasProviderInstance as unknown as import('../../../ports/providers/asaas-port').AsaasProviderPort)
                        : undefined;

                if (!asaasProvider?.getOnboardingUrl) {
                    log.warn('[OUTBOX] fetch_school_onboarding_url: Asaas não configurado ou sem getOnboardingUrl');
                    return;
                }

                let saved = 0;
                for (const school of schools) {
                    if (!school.accountApiKey?.trim()) continue;
                    let url: string | null = null;
                    try {
                        url = await asaasProvider.getOnboardingUrl(school.accountApiKey);
                    } catch (err: unknown) {
                        log.warn('[OUTBOX] fetch_school_onboarding_url: erro ao buscar URL', {
                            schoolId: school.id,
                            error: err instanceof Error ? err.message : String(err)
                        });
                    }
                    if (url?.trim()) {
                        await schoolsRepo.save(school.withOnboardingUrl(url));
                        saved++;
                        log.info('[OUTBOX] fetch_school_onboarding_url: onboarding URL salva', { schoolId: school.id });
                    }
                }
                log.info('[OUTBOX] fetch_school_onboarding_url completed', { total: schools.length, saved });
                return;
            }

            // ——— Notificações por email (processadas apenas quando o worker está ativo, ex.: módulo admin) ———
            if (job.name === 'send_welcome_school_email' || jobType === 'send_welcome_school_email') {
                log.info('[OUTBOX] Processando job de email: send_welcome_school_email');
                try {
                    const { createEmailProviderFromEnv } = await import('../../email/create-email-provider.js');
                    const { EmailService } = await import('../../email/email-service.js');
                    const provider = createEmailProviderFromEnv();
                    if (!provider) {
                        log.warn('[OUTBOX] send_welcome_school_email: EmailProvider não configurado (MAILCHIMP_*, SENDGRID_* ou EMAIL_* no .env), job ignorado');
                        return;
                    }
                    const p = event.payload as { to?: string; schoolName?: string; schoolEmail?: string; ownerName?: string; loginUrl?: string };
                    if (!p?.to || !p?.schoolName || !p?.schoolEmail) {
                        log.warn('[OUTBOX] send_welcome_school_email: payload inválido', { hasTo: !!p?.to, hasSchoolName: !!p?.schoolName });
                        return;
                    }
                    const emailService = new EmailService(provider);
                    await emailService.sendWelcomeSchoolEmail({
                        to: p.to,
                        schoolName: p.schoolName,
                        schoolEmail: p.schoolEmail,
                        ownerName: p.ownerName,
                        loginUrl: p.loginUrl
                    });
                    log.info('[OUTBOX] send_welcome_school_email enviado', { to: p.to });
                } catch (err) {
                    log.error('[OUTBOX] send_welcome_school_email falhou', { error: err instanceof Error ? err.message : String(err) });
                    throw err;
                }
                return;
            }

            if (job.name === 'send_welcome_student_email' || jobType === 'send_welcome_student_email') {
                log.info('[OUTBOX] Processando job de email: send_welcome_student_email');
                try {
                    const { createEmailProviderFromEnv } = await import('../../email/create-email-provider.js');
                    const { EmailService } = await import('../../email/email-service.js');
                    const provider = createEmailProviderFromEnv();
                    if (!provider) {
                        log.warn('[OUTBOX] send_welcome_student_email: EmailProvider não configurado, job ignorado');
                        return;
                    }
                    const p = event.payload as { to?: string; userName?: string; userEmail?: string; loginUrl?: string };
                    if (!p?.to || !p?.userName) {
                        log.warn('[OUTBOX] send_welcome_student_email: payload inválido', { hasTo: !!p?.to, hasUserName: !!p?.userName });
                        return;
                    }
                    const emailService = new EmailService(provider);
                    await emailService.sendWelcomeStudentEmail({
                        to: p.to,
                        userName: p.userName,
                        userEmail: p.userEmail,
                        loginUrl: p.loginUrl
                    });
                    log.info('[OUTBOX] send_welcome_student_email enviado', { to: p.to });
                } catch (err) {
                    log.error('[OUTBOX] send_welcome_student_email falhou', { error: err instanceof Error ? err.message : String(err) });
                    throw err;
                }
                return;
            }

            if (job.name === 'send_enrollment_confirmation_email' || jobType === 'send_enrollment_confirmation_email') {
                log.info('[OUTBOX] Processando job de email: send_enrollment_confirmation_email');
                try {
                    const { createEmailProviderFromEnv } = await import('../../email/create-email-provider.js');
                    const { EmailService } = await import('../../email/email-service.js');
                    const provider = createEmailProviderFromEnv();
                    if (!provider) {
                        log.warn('[OUTBOX] send_enrollment_confirmation_email: EmailProvider não configurado, job ignorado');
                        return;
                    }
                    const p = event.payload as { to?: string; studentName?: string; courseName?: string; schoolName?: string; className?: string; loginUrl?: string };
                    if (!p?.to || !p?.studentName || !p?.courseName || !p?.schoolName) {
                        log.warn('[OUTBOX] send_enrollment_confirmation_email: payload inválido', p);
                        return;
                    }
                    const emailService = new EmailService(provider);
                    await emailService.sendEnrollmentConfirmationEmail({
                        to: p.to,
                        studentName: p.studentName,
                        courseName: p.courseName,
                        schoolName: p.schoolName,
                        className: p.className,
                        loginUrl: p.loginUrl
                    });
                    log.info('[OUTBOX] send_enrollment_confirmation_email enviado', { to: p.to });
                } catch (err) {
                    log.error('[OUTBOX] send_enrollment_confirmation_email falhou', { error: err instanceof Error ? err.message : String(err) });
                    throw err;
                }
                return;
            }

            if (job.name === 'send_enrollment_request_received_email' || jobType === 'send_enrollment_request_received_email') {
                log.info('[OUTBOX] Processando job de email: send_enrollment_request_received_email');
                try {
                    const { createEmailProviderFromEnv } = await import('../../email/create-email-provider.js');
                    const { EmailService } = await import('../../email/email-service.js');
                    const { getEnrollmentRequestReceivedTemplate } = await import(
                        '../../email/templates/enrollment-request-received.template.js'
                    );
                    const provider = createEmailProviderFromEnv();
                    if (!provider) {
                        log.warn('[OUTBOX] send_enrollment_request_received_email: EmailProvider não configurado, job ignorado');
                        return;
                    }
                    const p = event.payload as {
                        to?: string;
                        studentName?: string;
                        schoolName?: string;
                        courseName?: string;
                        className?: string;
                        loginUrl?: string;
                    };
                    if (!p?.to || !p?.studentName || !p?.schoolName || !p?.courseName) {
                        log.warn('[OUTBOX] send_enrollment_request_received_email: payload inválido', p);
                        return;
                    }
                    const template = getEnrollmentRequestReceivedTemplate({
                        studentName: p.studentName,
                        schoolName: p.schoolName,
                        courseName: p.courseName,
                        className: p.className,
                        loginUrl: p.loginUrl
                    });
                    const emailService = new EmailService(provider);
                    await emailService.sendCustomEmail({
                        to: p.to,
                        subject: template.subject,
                        html: template.html,
                        text: template.text
                    });
                    log.info('[OUTBOX] send_enrollment_request_received_email enviado', { to: p.to });
                } catch (err) {
                    log.error('[OUTBOX] send_enrollment_request_received_email falhou', { error: err instanceof Error ? err.message : String(err) });
                    throw err;
                }
                return;
            }

            if (job.name === 'send_enrollment_request_rejected_email' || jobType === 'send_enrollment_request_rejected_email') {
                log.info('[OUTBOX] Processando job de email: send_enrollment_request_rejected_email');
                try {
                    const { createEmailProviderFromEnv } = await import('../../email/create-email-provider.js');
                    const { EmailService } = await import('../../email/email-service.js');
                    const { getEnrollmentRequestRejectedTemplate } = await import(
                        '../../email/templates/enrollment-request-rejected.template.js'
                    );
                    const provider = createEmailProviderFromEnv();
                    if (!provider) {
                        log.warn('[OUTBOX] send_enrollment_request_rejected_email: EmailProvider não configurado, job ignorado');
                        return;
                    }
                    const p = event.payload as {
                        to?: string;
                        studentName?: string;
                        schoolName?: string;
                        courseName?: string;
                        className?: string;
                        loginUrl?: string;
                        notes?: string | null;
                    };
                    if (!p?.to || !p?.studentName || !p?.schoolName || !p?.courseName) {
                        log.warn('[OUTBOX] send_enrollment_request_rejected_email: payload inválido', p);
                        return;
                    }
                    const template = getEnrollmentRequestRejectedTemplate({
                        studentName: p.studentName,
                        schoolName: p.schoolName,
                        courseName: p.courseName,
                        className: p.className,
                        loginUrl: p.loginUrl,
                        notes: p.notes ?? null
                    });
                    const emailService = new EmailService(provider);
                    await emailService.sendCustomEmail({
                        to: p.to,
                        subject: template.subject,
                        html: template.html,
                        text: template.text
                    });
                    log.info('[OUTBOX] send_enrollment_request_rejected_email enviado', { to: p.to });
                } catch (err) {
                    log.error('[OUTBOX] send_enrollment_request_rejected_email falhou', { error: err instanceof Error ? err.message : String(err) });
                    throw err;
                }
                return;
            }

            if (job.name === 'schedule_charge_due_reminders' || jobType === 'schedule_charge_due_reminders') {
                log.info('[OUTBOX] Processando job: schedule_charge_due_reminders');
                await ensureDb();
                try {
                    const { ScheduleChargeDueReminders } = await import('../../../app/use-cases/schedule-charge-due-reminders.js');
                    const { SchoolFinancialChargeRepositoryAdapter } = await import('../../db/typeorm/school-financial-charge-repository.adapter.js');
                    const { SchoolPlanInvoiceRepositoryAdapter } = await import('../../db/typeorm/school-plan-invoice-repository.adapter.js');
                    const { ChargeDueReminderRepositoryAdapter } = await import('../../db/typeorm/charge-due-reminder-repository.adapter.js');
                    const { OutboxProducer } = await import('./outbox-producer.js');
                    const { UserRepositoryAdapter } = await import('../../db/typeorm/user-repository.adapter.js');
                    const { SchoolRepositoryAdapter } = await import('../../db/typeorm/school-repository.js');
                    const { CourseRepositoryAdapter } = await import('../../db/typeorm/course-repository.js');
                    const { NotificationRepositoryAdapter } = await import('../../db/typeorm/notification-repository.adapter.js');
                    const { NotifyStudentUser } = await import('../../../app/use-cases/notify-student-user.js');

                    const chargeRepo = new SchoolFinancialChargeRepositoryAdapter();
                    const invoiceRepo = new SchoolPlanInvoiceRepositoryAdapter();
                    const reminderRepo = new ChargeDueReminderRepositoryAdapter();
                    const outbox = new OutboxProducer();
                    const userRepo = new UserRepositoryAdapter();
                    const schoolRepo = new SchoolRepositoryAdapter();
                    const courseRepo = new CourseRepositoryAdapter();
                    const notificationsRepo = new NotificationRepositoryAdapter();
                    const notifyStudent = new NotifyStudentUser(notificationsRepo, outbox);

                    const useCase = new ScheduleChargeDueReminders(
                        chargeRepo,
                        invoiceRepo,
                        reminderRepo,
                        outbox,
                        userRepo,
                        schoolRepo,
                        courseRepo,
                        notifyStudent
                    );
                    const result = await useCase.exec(undefined);
                    log.info('[OUTBOX] schedule_charge_due_reminders concluído', result);
                } catch (err) {
                    log.error('[OUTBOX] schedule_charge_due_reminders falhou', { error: err instanceof Error ? err.message : String(err) });
                    throw err;
                }
                return;
            }

            if (job.name === 'send_charge_due_reminder_email' || jobType === 'send_charge_due_reminder_email') {
                log.info('[OUTBOX] Processando job de email: send_charge_due_reminder_email');
                try {
                    const { createEmailProviderFromEnv } = await import('../../email/create-email-provider.js');
                    const { EmailService } = await import('../../email/email-service.js');
                    const { getChargeDueReminderTemplate } = await import('../../email/templates/charge-due-reminder.template.js');
                    const provider = createEmailProviderFromEnv();
                    if (!provider) {
                        log.warn('[OUTBOX] send_charge_due_reminder_email: EmailProvider não configurado, job ignorado');
                        return;
                    }
                    const p = event.payload as {
                        to?: string;
                        recipientName?: string;
                        description?: string;
                        amount?: string;
                        dueDate?: string;
                        type?: 'tuition' | 'enrollment' | 'plan';
                        courseName?: string;
                        boletoUrl?: string;
                    };
                    if (!p?.to || !p?.description || !p?.amount || !p?.dueDate || !p?.type) {
                        log.warn('[OUTBOX] send_charge_due_reminder_email: payload inválido', { hasTo: !!p?.to, hasDescription: !!p?.description });
                        return;
                    }
                    const template = getChargeDueReminderTemplate({
                        recipientName: p.recipientName ?? '',
                        description: p.description,
                        amount: p.amount,
                        dueDate: p.dueDate,
                        type: p.type,
                        courseName: p.courseName,
                        boletoUrl: p.boletoUrl ?? null
                    });
                    const emailService = new EmailService(provider);
                    await emailService.sendCustomEmail({
                        to: p.to,
                        subject: template.subject,
                        html: template.html,
                        text: template.text
                    });
                    log.info('[OUTBOX] send_charge_due_reminder_email enviado', { to: p.to });
                } catch (err) {
                    log.error('[OUTBOX] send_charge_due_reminder_email falhou', { error: err instanceof Error ? err.message : String(err) });
                    throw err;
                }
                return;
            }

            if (job.name === 'generate_monthly_tuition_charges' || jobType === 'generate_monthly_tuition_charges') {
                log.info('[OUTBOX] Processando job: generate_monthly_tuition_charges');
                await ensureDb();
                try {
                    const { runGenerateMonthlyCharges } = await import('../../cron/generate-monthly-charges.js');
                    const result = await runGenerateMonthlyCharges();
                    log.info('[OUTBOX] generate_monthly_tuition_charges concluído', result);
                } catch (err) {
                    log.error('[OUTBOX] generate_monthly_tuition_charges falhou', { error: err instanceof Error ? err.message : String(err) });
                    throw err;
                }
                return;
            }

            if (job.name === 'send_boleto_notifications' || jobType === 'send_boleto_notifications') {
                log.info('[OUTBOX] Processando job: send_boleto_notifications');
                await ensureDb();
                try {
                    const { runSendBoletoNotifications } = await import('../../cron/send-boleto-notifications.js');
                    const result = await runSendBoletoNotifications();
                    log.info('[OUTBOX] send_boleto_notifications concluído', result);
                } catch (err) {
                    log.error('[OUTBOX] send_boleto_notifications falhou', { error: err instanceof Error ? err.message : String(err) });
                    throw err;
                }
                return;
            }

            // default: manter comportamento atual (log)
            log.warn('[OUTBOX] unhandled event', { name: job.name, payload: event.payload });
        },
        { 
            connection,
            concurrency: 5, // Processar até 5 jobs simultaneamente
            limiter: {
                max: 10,
                duration: 1000
            }
        }
    );

    workerInstance.on('completed', (job) => {
        log.info('[Worker] Job completado', { name: job.name, id: job.id, data: job.data });
    });

    workerInstance.on('failed', (job, err) => {
        log.error('[Worker] Job falhou', { 
            name: job?.name, 
            id: job?.id,
            data: job?.data,
            error: err.message,
            stack: err.stack,
            attemptsMade: job?.attemptsMade
        });
    });

    workerInstance.on('error', (err) => {
        log.error('[Worker] Erro no worker', { error: err.message, stack: err.stack });
    });

    workerInstance.on('active', (job) => {
        log.info('[Worker] Job ativo', { name: job.name, id: job.id });
    });

    workerInstance.on('stalled', (jobId) => {
        log.warn('[Worker] Job travado', { jobId });
    });

    log.info('[Worker Manager] Worker BullMQ iniciado com sucesso');
    return workerInstance;
}

let isShuttingDown = false;

/**
 * Para o worker, aguardando jobs ativos terminarem
 * @param timeoutMs Timeout em milissegundos para aguardar jobs terminarem (padrão: 30 segundos)
 */
export async function stopWorker(timeoutMs: number = 30000): Promise<void> {
    if (!workerInstance || isShuttingDown) {
        return;
    }

    isShuttingDown = true;
    log.info('[Worker Manager] Iniciando shutdown gracioso do worker...');
    
    try {
        const { Queue } = await import('bullmq');
        const queue = new Queue('outbox', { connection });
        const activeJobs = await queue.getActive();
        if (activeJobs.length > 0) {
            log.info(`[Worker Manager] Aguardando ${activeJobs.length} job(s) ativo(s) terminarem...`, {
                jobs: activeJobs.map((j: any) => ({ name: j.name, id: j.id }))
            });
        }
        await queue.close();

        // Fechar o worker (ele aguardará jobs ativos terminarem automaticamente)
        // O BullMQ worker.close() já aguarda jobs ativos terminarem
        const closePromise = workerInstance.close();
        
        // Adicionar timeout para não esperar indefinidamente
        const timeoutPromise = new Promise<void>((_, reject) => {
            setTimeout(() => {
                reject(new Error(`Timeout ao aguardar worker fechar após ${timeoutMs}ms`));
            }, timeoutMs);
        });

        await Promise.race([closePromise, timeoutPromise]);
        
        const instance = workerInstance;
        workerInstance = null;
        isShuttingDown = false;
        log.info('[Worker Manager] Worker parado');
    } catch (error) {
        isShuttingDown = false;
        if (error instanceof Error && error.message.includes('Timeout')) {
            log.warn('[Worker Manager] Timeout ao aguardar jobs terminarem. Forçando fechamento...');
            // Forçar fechamento mesmo com jobs pendentes
            if (workerInstance) {
                await workerInstance.close(true); // force = true
                workerInstance = null;
            }
        } else {
            log.error('[Worker Manager] Erro ao parar worker', {
                error: error instanceof Error ? error.message : String(error)
            });
            throw error;
        }
    }
}

/**
 * Verifica se o worker está rodando
 */
export function isWorkerRunning(): boolean {
    return workerInstance !== null;
}
