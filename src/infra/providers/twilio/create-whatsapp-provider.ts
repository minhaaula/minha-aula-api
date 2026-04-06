/**
 * Cria WhatsAppProvider a partir das variáveis de ambiente.
 * Usado pelo worker para processar jobs whatsapp_notification.
 * Variáveis: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_FROM.
 */

import { config as dotenvConfig } from 'dotenv';
import { resolve } from 'path';
import type { WhatsAppProviderPort } from '../../../ports/providers/whatsapp-provider.port';
import { TwilioWhatsAppProvider } from './whatsapp-provider';
import { log } from '../../../shared/logger';

export function createWhatsAppProviderFromEnv(): WhatsAppProviderPort | undefined {
    // Garantir .env no worker (pode rodar em processo que não carregou dotenv no startup)
    dotenvConfig({ path: resolve(process.cwd(), '.env') });

    const accountSid = process.env.TWILIO_ACCOUNT_SID?.trim();
    const authToken = process.env.TWILIO_AUTH_TOKEN?.trim();
    const from = process.env.TWILIO_WHATSAPP_FROM?.trim();
    if (!accountSid || !authToken || !from) {
        const missing = [
            !accountSid && 'TWILIO_ACCOUNT_SID',
            !authToken && 'TWILIO_AUTH_TOKEN',
            !from && 'TWILIO_WHATSAPP_FROM',
        ].filter(Boolean) as string[];
        log.warn('[WhatsApp] Provider não criado – variáveis ausentes no processo do worker:', missing);
        return undefined;
    }
    return new TwilioWhatsAppProvider({
        accountSid,
        authToken,
        from,
    });
}
