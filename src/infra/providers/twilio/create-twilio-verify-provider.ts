/**
 * Twilio Verify a partir do ambiente.
 * Variáveis: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_VERIFY_SERVICE_SID (VA…).
 */

import { config as dotenvConfig } from 'dotenv';
import { resolve } from 'path';
import type { TwilioVerifyPort } from '../../../ports/providers/twilio-verify.port';
import { log } from '../../../shared/logger';
import { TwilioVerifyProvider } from './twilio-verify-provider';

export function createTwilioVerifyFromEnv(): TwilioVerifyPort | undefined {
    dotenvConfig({ path: resolve(process.cwd(), '.env') });

    const accountSid = process.env.TWILIO_ACCOUNT_SID?.trim();
    const authToken = process.env.TWILIO_AUTH_TOKEN?.trim();
    const serviceSid = process.env.TWILIO_VERIFY_SERVICE_SID?.trim();
    if (!accountSid || !authToken || !serviceSid) {
        const missing = [
            !accountSid && 'TWILIO_ACCOUNT_SID',
            !authToken && 'TWILIO_AUTH_TOKEN',
            !serviceSid && 'TWILIO_VERIFY_SERVICE_SID'
        ].filter(Boolean) as string[];
        log.warn('[Twilio Verify] Não configurado – variáveis ausentes:', missing);
        return undefined;
    }
    return new TwilioVerifyProvider({
        accountSid,
        authToken,
        serviceSid
    });
}
