/**
 * Twilio Verify (SMS/WhatsApp) — o Twilio gera e envia o código; a API só inicia a verificação e checa o código.
 * @see https://www.twilio.com/docs/verify/api/verification
 */
export type TwilioStartVerificationResult = {
    /** SID do recurso Verification (VE…) retornado por `verifications.create`. */
    verificationSid: string;
    /** Prazo informado pelo Twilio, quando existir; caso contrário o use case usa TTL local. */
    validUntil: Date | null;
};

export interface TwilioVerifyPort {
    /** Inicia uma verificação WhatsApp (`channel: whatsapp` + `to`). Não gera OTP localmente. */
    sendVerification(rawPhone: string): Promise<TwilioStartVerificationResult>;

    /** Valida o código informado pelo usuário contra o Verify Service. */
    checkVerification(rawPhone: string, code: string): Promise<boolean>;
}
