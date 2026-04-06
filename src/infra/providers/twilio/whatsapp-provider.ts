import type { WhatsAppProviderPort, SendWhatsAppInput } from '../../../ports/providers/whatsapp-provider.port';
import { toE164Brazil } from '../../../shared/phone-e164';
import { log } from '../../../shared/logger';
import { sanitizeForLogging } from '../../../shared/log-sanitizer';

export interface TwilioWhatsAppConfig {
    accountSid: string;
    authToken: string;
    /** Número de origem com prefixo whatsapp: (ex: whatsapp:+14155238886 para sandbox) */
    from: string;
}

/**
 * Adapter para envio de mensagens WhatsApp via Twilio.
 * Número "to" em formato BR (11999999999) é normalizado para E.164 (+5511999999999).
 */
export class TwilioWhatsAppProvider implements WhatsAppProviderPort {
    private client: import('twilio').Twilio;
    private from: string;

    constructor(config: TwilioWhatsAppConfig) {
        this.from = config.from.startsWith('whatsapp:') ? config.from : `whatsapp:${config.from}`;
        try {
            // eslint-disable-next-line @typescript-eslint/no-require-imports
            const twilio = require('twilio');
            this.client = twilio(config.accountSid, config.authToken);
        } catch (e) {
            throw new Error('Twilio não está instalado. Execute: npm install twilio');
        }
    }

    async sendMessage(input: SendWhatsAppInput): Promise<void> {
        const body = (input.body ?? '').trim();
        const mediaUrls = Array.isArray(input.mediaUrls) ? input.mediaUrls.filter((u) => typeof u === 'string' && u.trim()) : [];
        if (!body && mediaUrls.length === 0) {
            throw new Error('WhatsApp message requires body and/or mediaUrls');
        }
        const e164 = toE164Brazil(input.to);
        if (!e164) {
            throw new Error('WhatsApp "to" must be a valid Brazilian phone number');
        }
        const to = e164.startsWith('whatsapp:') ? e164 : `whatsapp:${e164}`;
        try {
            if (mediaUrls.length === 0) {
                await this.client.messages.create({
                    from: this.from,
                    to,
                    body: body || ' '
                });
                log.info('[Twilio WhatsApp] Mensagem enviada', sanitizeForLogging({ to: e164 }));
                return;
            }
            const firstUrl = mediaUrls[0];
            await this.client.messages.create({
                from: this.from,
                to,
                body: body || ' ',
                mediaUrl: [firstUrl]
            });
            log.info('[Twilio WhatsApp] Mensagem com mídia enviada', sanitizeForLogging({ to: e164 }));
            for (let i = 1; i < mediaUrls.length; i++) {
                await this.client.messages.create({
                    from: this.from,
                    to,
                    mediaUrl: [mediaUrls[i]!]
                });
                log.info('[Twilio WhatsApp] Mídia adicional enviada', sanitizeForLogging({ to: e164, index: i }));
            }
        } catch (error: unknown) {
            log.error('[Twilio WhatsApp] Erro ao enviar', sanitizeForLogging({ to: e164, error }));
            throw error;
        }
    }
}
