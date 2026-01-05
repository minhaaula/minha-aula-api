/**
 * Serviço de email que facilita o envio de emails usando templates
 */

import { EmailProviderPort, SendEmailInput } from '../../ports/providers/email-provider.port';
import { getPasswordResetTemplate, getWelcomeTemplate } from './templates';
import type { PasswordResetTemplateData, WelcomeTemplateData } from './templates';

export class EmailService {
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
     * Envia email customizado (para casos específicos)
     */
    async sendCustomEmail(input: SendEmailInput): Promise<void> {
        await this.emailProvider.sendEmail(input);
    }
}





