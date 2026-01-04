import { EmailProviderPort, SendEmailInput } from '../../../ports/providers/email-provider.port';

export interface TwilioSendGridConfig {
    apiKey: string;
    from: string;
    fromName?: string;
}

/**
 * Adapter para Twilio SendGrid
 * Implementa EmailProviderPort usando a API do SendGrid
 */
export class TwilioSendGridEmailProvider implements EmailProviderPort {
    private apiKey: string;
    private from: string;
    private fromName?: string;
    private sendgridClient: any;

    constructor(config: TwilioSendGridConfig) {
        this.apiKey = config.apiKey;
        this.from = config.from;
        this.fromName = config.fromName;

        // Lazy load do @sendgrid/mail para evitar erro se não estiver instalado
        try {
            // eslint-disable-next-line @typescript-eslint/no-require-imports
            const sgMail = require('@sendgrid/mail');
            sgMail.setApiKey(this.apiKey);
            this.sendgridClient = sgMail;
        } catch (error) {
            throw new Error(
                'Twilio SendGrid não está instalado. Execute: npm install @sendgrid/mail'
            );
        }
    }

    async sendEmail(input: SendEmailInput): Promise<void> {
        try {
            const msg = {
                to: input.to,
                from: {
                    email: this.from,
                    name: this.fromName || 'Payments API'
                },
                subject: input.subject,
                html: input.html,
                text: input.text
            };

            await this.sendgridClient.send(msg);

            console.log('Email enviado com sucesso via SendGrid:', {
                to: input.to,
                subject: input.subject
            });
        } catch (error: any) {
            console.error('Erro ao enviar email via SendGrid:', error);
            
            // Log detalhado do erro do SendGrid
            if (error.response) {
                console.error('SendGrid Error Details:', {
                    status: error.response.status,
                    body: error.response.body,
                    headers: error.response.headers
                });
            }
            
            throw error;
        }
    }
}




