/**
 * Cria EmailProvider a partir das variáveis de ambiente.
 * Usado pelo worker (admin) para processar jobs de email; pode ser reutilizado no bootstrap.
 * Prioridade: Mailchimp > Twilio SendGrid > Nodemailer.
 */

import type { EmailProviderPort } from '../../ports/providers/email-provider.port';
import { MailchimpEmailProvider } from '../providers/mailchimp/email-provider';
import { TwilioSendGridEmailProvider } from '../providers/twilio/email-provider';
import { NodemailerEmailProvider } from '../providers/nodemailer/email-provider';

export function createEmailProviderFromEnv(): EmailProviderPort | undefined {
    const mailchimpApiKey = process.env.MAILCHIMP_API_KEY;
    const mailchimpFrom = process.env.MAILCHIMP_FROM_EMAIL;
    if (mailchimpApiKey && mailchimpFrom) {
        try {
            return new MailchimpEmailProvider({
                apiKey: mailchimpApiKey,
                from: mailchimpFrom,
                fromName: process.env.MAILCHIMP_FROM_NAME
            });
        } catch {
            // fallback
        }
    }

    const sendgridApiKey = process.env.SENDGRID_API_KEY;
    const sendgridFrom = process.env.SENDGRID_FROM_EMAIL;
    if (sendgridApiKey && sendgridFrom) {
        try {
            return new TwilioSendGridEmailProvider({
                apiKey: sendgridApiKey,
                from: sendgridFrom,
                fromName: process.env.SENDGRID_FROM_NAME
            });
        } catch {
            // fallback
        }
    }

    const emailHost = process.env.EMAIL_HOST;
    const emailPort = process.env.EMAIL_PORT;
    const emailUser = process.env.EMAIL_USER;
    const emailPass = process.env.EMAIL_PASS;
    if (emailHost && emailPort && emailUser && emailPass) {
        try {
            return new NodemailerEmailProvider({
                host: emailHost,
                port: Number(emailPort),
                auth: { user: emailUser, pass: emailPass },
                from: process.env.EMAIL_FROM
            });
        } catch {
            // ignore
        }
    }

    return undefined;
}
