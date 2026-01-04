import { EmailProviderPort, SendEmailInput } from '../../../ports/providers/email-provider.port';
import nodemailer, { Transporter } from 'nodemailer';

export interface MailchimpConfig {
    apiKey: string;
    from: string;
    fromName?: string;
}

export class MailchimpEmailProvider implements EmailProviderPort {
    private apiKey: string;
    private from: string;
    private fromName?: string;
    private transporter: Transporter;
    private readonly mandrillSmtpHost = 'smtp.mandrillapp.com';
    private readonly mandrillSmtpPort = 587;

    constructor(config: MailchimpConfig) {
        this.apiKey = config.apiKey;
        this.from = config.from;
        this.fromName = config.fromName;

        const smtpUser = this.extractSmtpUserFromApiKey(config.apiKey);
        
        this.transporter = nodemailer.createTransport({
            host: this.mandrillSmtpHost,
            port: this.mandrillSmtpPort,
            secure: false,
            auth: {
                user: smtpUser,
                pass: this.apiKey
            }
        });
    }

    private extractSmtpUserFromApiKey(apiKey: string): string {
        if (apiKey.startsWith('md-')) {
            return 'CT SERVICOS EM TECNOLOGIA';
        }
        return 'mandrill';
    }

    async sendEmail(input: SendEmailInput): Promise<void> {
        try {
            const mailOptions = {
                from: `"${this.fromName || 'Payments API'}" <${this.from}>`,
                to: input.to,
                subject: input.subject,
                html: input.html,
                text: input.text || this.htmlToText(input.html)
            };

            const info = await this.transporter.sendMail(mailOptions);

            console.log('Email enviado com sucesso via Mailchimp (SMTP):', {
                to: input.to,
                subject: input.subject,
                messageId: info.messageId
            });
        } catch (error: any) {
            console.error('Erro ao enviar email via Mailchimp:', error);
            
            if (error.response) {
                console.error('Mailchimp Error Details:', {
                    status: error.response.status,
                    data: error.response.data
                });
            }
            
            throw error;
        }
    }

    private htmlToText(html: string): string {
        return html
            .replace(/<style[^>]*>.*?<\/style>/gis, '')
            .replace(/<script[^>]*>.*?<\/script>/gis, '')
            .replace(/<[^>]+>/g, '')
            .replace(/\s+/g, ' ')
            .trim();
    }
}


