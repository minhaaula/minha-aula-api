import 'dotenv/config';
import { AppDataSource } from '../db/typeorm/datasource';
import { SchoolPlanInvoiceRepositoryAdapter } from '../db/typeorm/school-plan-invoice-repository.adapter';
import { SchoolFinancialChargeRepositoryAdapter } from '../db/typeorm/school-financial-charge-repository.adapter';
import { SchoolRepositoryAdapter } from '../db/typeorm/school-repository';
import { UserRepositoryAdapter } from '../db/typeorm/user-repository.adapter';
import { CourseRepositoryAdapter } from '../db/typeorm/course-repository';
import { EmailService } from '../email/email-service';
import { getBoletoNotificationTemplate } from '../email/templates/boleto-notification.template';
import { log } from '../../shared/logger';
import { MoreThan, Not, IsNull } from 'typeorm';
import { SchoolPlanInvoiceOrm } from '../db/typeorm/entities/school-plan-invoice.orm';
import { SchoolFinancialChargeOrm } from '../db/typeorm/entities/school-financial-charge.orm';

/**
 * Formata valor em centavos para formato brasileiro
 */
function formatCurrency(cents: number, currency: string = 'BRL'): string {
    const value = cents / 100;
    if (currency === 'BRL') {
        return new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL'
        }).format(value);
    }
    return `${currency} ${value.toFixed(2)}`;
}

/**
 * Formata data para formato brasileiro
 */
function formatDate(date: Date): string {
    return new Intl.DateTimeFormat('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    }).format(date);
}

async function main() {
    try {
        log.info('[Cron] Iniciando envio de notificações de boletos');

        // Inicializar conexão com banco de dados
        if (!AppDataSource.isInitialized) {
            await AppDataSource.initialize();
            log.info('[Cron] Conexão com banco de dados estabelecida');
        }

        // Criar repositórios
        const invoiceRepo = new SchoolPlanInvoiceRepositoryAdapter();
        const chargeRepo = new SchoolFinancialChargeRepositoryAdapter();
        const schoolRepo = new SchoolRepositoryAdapter();
        const userRepo = new UserRepositoryAdapter();
        const courseRepo = new CourseRepositoryAdapter();

        // Configurar email provider
        // Prioridade: Mailchimp > Twilio SendGrid > Nodemailer
        let emailProvider: any = null;
        const { TwilioSendGridEmailProvider } = await import('../providers/twilio/email-provider');
        const { NodemailerEmailProvider } = await import('../providers/nodemailer/email-provider');
        const { MailchimpEmailProvider } = await import('../providers/mailchimp/email-provider');

        // Tentar Mailchimp primeiro
        const mailchimpApiKey = process.env.MAILCHIMP_API_KEY;
        const mailchimpFrom = process.env.MAILCHIMP_FROM_EMAIL;
        if (mailchimpApiKey && mailchimpFrom) {
            try {
                emailProvider = new MailchimpEmailProvider({
                    apiKey: mailchimpApiKey,
                    from: mailchimpFrom,
                    fromName: process.env.MAILCHIMP_FROM_NAME
                });
                log.info('[Cron] EmailProvider configurado: Mailchimp');
            } catch (error) {
                log.error('[Cron] Erro ao configurar Mailchimp:', error);
            }
        }

        // Fallback para SendGrid
        if (!emailProvider) {
            const sendgridApiKey = process.env.SENDGRID_API_KEY;
            const sendgridFrom = process.env.SENDGRID_FROM_EMAIL;
            if (sendgridApiKey && sendgridFrom) {
                try {
                    emailProvider = new TwilioSendGridEmailProvider({
                        apiKey: sendgridApiKey,
                        from: sendgridFrom,
                        fromName: process.env.SENDGRID_FROM_NAME
                    });
                    log.info('[Cron] EmailProvider configurado: Twilio SendGrid');
                } catch (error) {
                    log.error('[Cron] Erro ao configurar SendGrid:', error);
                }
            }
        }

        // Fallback para Nodemailer
        if (!emailProvider) {
            const emailHost = process.env.EMAIL_HOST;
            const emailPort = process.env.EMAIL_PORT;
            const emailUser = process.env.EMAIL_USER;
            const emailPass = process.env.EMAIL_PASS;
            if (emailHost && emailPort && emailUser && emailPass) {
                try {
                    emailProvider = new NodemailerEmailProvider({
                        host: emailHost,
                        port: Number(emailPort),
                        auth: {
                            user: emailUser,
                            pass: emailPass
                        },
                        from: process.env.EMAIL_FROM
                    });
                    log.info('[Cron] EmailProvider configurado: Nodemailer');
                } catch (error) {
                    log.error('[Cron] Erro ao configurar Nodemailer:', error);
                }
            }
        }

        if (!emailProvider) {
            log.error('[Cron] Nenhum EmailProvider configurado. Configure uma das opções: MAILCHIMP_API_KEY, SENDGRID_API_KEY ou EMAIL_HOST');
            process.exit(1);
        }

        const emailService = new EmailService(emailProvider);

        // Buscar boletos criados nas últimas 24 horas
        const now = new Date();
        const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

        // Buscar faturas de planos (SchoolPlanInvoice)
        const invoiceOrmRepo = AppDataSource.getRepository(SchoolPlanInvoiceOrm);
        const recentInvoices = await invoiceOrmRepo.find({
            where: {
                createdAt: MoreThan(yesterday),
                status: 'ISSUED',
                boletoUrl: Not(IsNull()) // Apenas boletos com URL
            }
        });

        log.info(`[Cron] Encontradas ${recentInvoices.length} faturas de planos para notificar`);

        let invoicesSent = 0;
        let invoicesErrors = 0;

        for (const invoiceOrm of recentInvoices) {
            try {
                const invoice = await invoiceRepo.findByProviderRef(invoiceOrm.providerRef || '');
                if (!invoice || !invoice.boletoUrl) {
                    continue;
                }

                // Buscar escola
                const school = await schoolRepo.findById(invoice.schoolId);
                if (!school) {
                    log.warn(`[Cron] Escola não encontrada para fatura ${invoice.id}`);
                    continue;
                }

                const recipientEmail = school.email;
                if (!recipientEmail) {
                    log.warn(`[Cron] Escola ${school.id} não tem e-mail configurado`);
                    continue;
                }

                const template = getBoletoNotificationTemplate({
                    studentName: school.name,
                    boletoUrl: invoice.boletoUrl,
                    digitableLine: invoice.digitableLine,
                    amount: formatCurrency(invoice.amountCents, invoice.currency),
                    dueDate: formatDate(invoice.dueDate),
                    description: invoice.description || 'Assinatura',
                    type: 'plan'
                });

                await emailService.sendCustomEmail({
                    to: recipientEmail,
                    subject: template.subject,
                    html: template.html,
                    text: template.text
                });

                invoicesSent++;
                log.info(`[Cron] E-mail de fatura enviado para ${recipientEmail} (fatura ${invoice.id})`);
            } catch (error) {
                invoicesErrors++;
                log.error(`[Cron] Erro ao enviar e-mail de fatura ${invoiceOrm.id}:`, error);
            }
        }

        // Buscar cobranças de alunos (SchoolFinancialCharge) com boletos
        const chargeOrmRepo = AppDataSource.getRepository(SchoolFinancialChargeOrm);
        const recentCharges = await chargeOrmRepo.find({
            where: {
                createdAt: MoreThan(yesterday),
                status: 'OPEN',
                asaasPaymentId: Not(IsNull()), // Apenas cobranças com payment ID (geradas no Asaas)
                asaasInvoiceUrl: Not(IsNull()) // Apenas cobranças com URL de boleto
            }
        });

        log.info(`[Cron] Encontradas ${recentCharges.length} cobranças de alunos para notificar`);

        let chargesSent = 0;
        let chargesErrors = 0;

        for (const chargeOrm of recentCharges) {
            try {
                const charge = await chargeRepo.findById(chargeOrm.id);
                if (!charge || !chargeOrm.asaasInvoiceUrl) {
                    continue;
                }

                // Buscar usuário responsável
                const owner = await userRepo.findById(charge.ownerUserId);
                if (!owner) {
                    log.warn(`[Cron] Usuário não encontrado para cobrança ${charge.id}`);
                    continue;
                }

                const recipientEmail = owner.email.value;
                if (!recipientEmail) {
                    log.warn(`[Cron] Usuário ${owner.id} não tem e-mail configurado`);
                    continue;
                }

                // Buscar curso para obter nome
                const course = await courseRepo.findById(charge.courseId);
                const courseName = course?.name || 'Curso';

                // Determinar tipo de cobrança
                const chargeType = charge.chargeType === 'TUITION' ? 'tuition' : 
                                 charge.chargeType === 'ENROLLMENT' ? 'enrollment' : 'enrollment';

                const template = getBoletoNotificationTemplate({
                    studentName: owner.fullName,
                    boletoUrl: chargeOrm.asaasInvoiceUrl,
                    digitableLine: null, // Asaas geralmente não fornece linha digitável diretamente
                    amount: formatCurrency(charge.netAmountCents, 'BRL'),
                    dueDate: formatDate(charge.dueDate),
                    description: charge.description || `${chargeType === 'tuition' ? 'Mensalidade' : 'Taxa de Matrícula'}`,
                    type: chargeType,
                    courseName: chargeType === 'tuition' ? courseName : undefined
                });

                await emailService.sendCustomEmail({
                    to: recipientEmail,
                    subject: template.subject,
                    html: template.html,
                    text: template.text
                });

                chargesSent++;
                log.info(`[Cron] E-mail de cobrança enviado para ${recipientEmail} (cobrança ${charge.id})`);
            } catch (error) {
                chargesErrors++;
                log.error(`[Cron] Erro ao enviar e-mail de cobrança ${chargeOrm.id}:`, error);
            }
        }

        log.info('[Cron] Envio de notificações concluído', {
            invoices: {
                found: recentInvoices.length,
                sent: invoicesSent,
                errors: invoicesErrors
            },
            charges: {
                found: recentCharges.length,
                sent: chargesSent,
                errors: chargesErrors
            },
            total: {
                sent: invoicesSent + chargesSent,
                errors: invoicesErrors + chargesErrors
            }
        });

        process.exit(0);
    } catch (error) {
        log.error('[Cron] Erro fatal ao enviar notificações de boletos', {
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined
        });
        process.exit(1);
    }
}

// Executar apenas se chamado diretamente
if (require.main === module) {
    main();
}

