/**
 * Serviço de email que facilita o envio de emails usando templates
 */

import { EmailProviderPort, SendEmailInput } from '../../ports/providers/email-provider.port';
import {
    getPasswordResetTemplate,
    getWelcomeTemplate,
    getEmailConfirmationTemplate,
    getPaymentNotificationTemplate,
    getWelcomeSchoolTemplate,
    getWelcomeStudentTemplate,
    getEnrollmentConfirmationTemplate
} from './templates';
import type {
    PasswordResetTemplateData,
    WelcomeTemplateData,
    EmailConfirmationTemplateData,
    PaymentNotificationTemplateData
} from './templates';
import type {
    NotificationEmailPort,
    WelcomeSchoolEmailData,
    WelcomeStudentEmailData,
    EnrollmentConfirmationEmailData
} from '../../ports/providers/notification-email.port';

export class EmailService implements NotificationEmailPort {
    constructor(private readonly emailProvider: EmailProviderPort) {}

    /**
     * Envia email de redefinição de senha usando template
     */
    async sendPasswordResetEmail(data: PasswordResetTemplateData & { to: string }): Promise<void> {
        const template = getPasswordResetTemplate(data);
        await this.emailProvider.sendEmail({
            to: data.to,
            subject: template.subject,
            html: template.html,
            text: template.text
        });
    }

    /**
     * Envia email de boas-vindas usando template
     */
    async sendWelcomeEmail(data: WelcomeTemplateData & { to: string }): Promise<void> {
        const template = getWelcomeTemplate(data);
        await this.emailProvider.sendEmail({
            to: data.to,
            subject: template.subject,
            html: template.html,
            text: template.text
        });
    }

    /**
     * Envia email de confirmação de endereço de email
     */
    async sendEmailConfirmationEmail(data: EmailConfirmationTemplateData & { to: string }): Promise<void> {
        const template = getEmailConfirmationTemplate(data);
        await this.emailProvider.sendEmail({
            to: data.to,
            subject: template.subject,
            html: template.html,
            text: template.text
        });
    }

    /**
     * Envia email de notificação de pagamento confirmado
     */
    async sendPaymentNotificationEmail(data: PaymentNotificationTemplateData & { to: string }): Promise<void> {
        const template = getPaymentNotificationTemplate(data);
        await this.emailProvider.sendEmail({
            to: data.to,
            subject: template.subject,
            html: template.html,
            text: template.text
        });
    }

    /**
     * Envia email de boas-vindas para escola (cadastro da escola)
     */
    async sendWelcomeSchoolEmail(data: WelcomeSchoolEmailData): Promise<void> {
        const template = getWelcomeSchoolTemplate({
            schoolName: data.schoolName,
            schoolEmail: data.schoolEmail,
            ownerName: data.ownerName,
            loginUrl: data.loginUrl
        });
        await this.emailProvider.sendEmail({
            to: data.to,
            subject: template.subject,
            html: template.html,
            text: template.text
        });
    }

    /**
     * Envia email de boas-vindas para aluno (cadastro com persona STUDENT)
     */
    async sendWelcomeStudentEmail(data: WelcomeStudentEmailData): Promise<void> {
        const template = getWelcomeStudentTemplate({
            userName: data.userName,
            userEmail: data.userEmail,
            loginUrl: data.loginUrl
        });
        await this.emailProvider.sendEmail({
            to: data.to,
            subject: template.subject,
            html: template.html,
            text: template.text
        });
    }

    /**
     * Envia email de confirmação de matrícula (aluno matriculado em curso)
     */
    async sendEnrollmentConfirmationEmail(data: EnrollmentConfirmationEmailData): Promise<void> {
        const template = getEnrollmentConfirmationTemplate({
            studentName: data.studentName,
            courseName: data.courseName,
            schoolName: data.schoolName,
            className: data.className,
            loginUrl: data.loginUrl
        });
        await this.emailProvider.sendEmail({
            to: data.to,
            subject: template.subject,
            html: template.html,
            text: template.text
        });
    }

    /**
     * Envia email customizado (para casos específicos)
     */
    async sendCustomEmail(input: SendEmailInput): Promise<void> {
        await this.emailProvider.sendEmail(input);
    }
}










