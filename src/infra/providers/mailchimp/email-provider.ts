import { EmailProviderPort, SendEmailInput } from '../../../ports/providers/email-provider.port';
import axios, { AxiosInstance } from 'axios';

export interface MailchimpConfig {
    apiKey: string;
    from: string;
    fromName?: string;
}

export class MailchimpEmailProvider implements EmailProviderPort {
    private apiKey: string;
    private from: string;
    private fromName?: string;
    private client: AxiosInstance;
    private readonly mandrillApiUrl = 'https://mandrillapp.com/api/1.0';

    constructor(config: MailchimpConfig) {
        this.apiKey = config.apiKey;
        this.from = config.from;
        this.fromName = config.fromName;

        this.client = axios.create({
            baseURL: this.mandrillApiUrl,
            headers: {
                'Content-Type': 'application/json'
            }
        });
    }

    async sendEmail(input: SendEmailInput): Promise<void> {
        try {
            const message = {
                html: input.html,
                text: input.text || this.htmlToText(input.html),
                subject: input.subject,
                from_email: this.from,
                from_name: this.fromName || 'Payments API',
                to: [
                    {
                        email: input.to,
                        type: 'to'
                    }
                ],
                important: false,
                track_opens: true,
                track_clicks: true,
                auto_text: true,
                auto_html: false,
                inline_css: true,
                preserve_recipients: false
            };

            const response = await this.client.post('/messages/send.json', {
                key: this.apiKey,
                message
            });

            if (response.data && response.data[0]) {
                const result = response.data[0];
                if (result.status === 'rejected' || result.status === 'invalid') {
                    throw new Error(`Email rejeitado pelo Mailchimp: ${result.reject_reason || 'Motivo desconhecido'}`);
                }

                console.log('Email enviado com sucesso via Mailchimp:', {
                    to: input.to,
                    subject: input.subject,
                    messageId: result._id
                });
            } else {
                throw new Error('Resposta inesperada do Mailchimp');
            }
        } catch (error: any) {
            console.error('Erro ao enviar email via Mailchimp:', error);
            
            if (error.response) {
                console.error('Mailchimp Error Details:', {
                    status: error.response.status,
                    data: error.response.data,
                    headers: error.response.headers
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


