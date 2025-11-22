import nodemailer, { Transporter } from 'nodemailer';
import { EmailProviderPort, SendEmailInput } from '../../../ports/providers/email-provider.port';

export interface NodemailerConfig {
    host: string;
    port: number;
    auth: {
        user: string;
        pass: string;
    };
    from?: string;
}

export class NodemailerEmailProvider implements EmailProviderPort {
    private transporter: Transporter;
    private from: string;

    constructor(config: NodemailerConfig) {
        this.transporter = nodemailer.createTransport({
            host: config.host,
            port: config.port,
            auth: config.auth
        });
        this.from = config.from || 'noreply@payments-api.com';
    }

    async sendEmail(input: SendEmailInput): Promise<void> {
        try {
            const info = await this.transporter.sendMail({
                from: this.from,
                to: input.to,
                subject: input.subject,
                html: input.html,
                text: input.text
            });
            console.log('Email enviado com sucesso:', {
                messageId: info.messageId,
                to: input.to,
                subject: input.subject
            });
        } catch (error) {
            console.error('Erro ao enviar email:', error);
            throw error;
        }
    }
}

