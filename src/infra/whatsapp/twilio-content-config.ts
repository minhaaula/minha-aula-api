/**
 * Content SIDs (Twilio Content API) — templates aprovados no Console.
 * Nomes amigáveis no Twilio: solicitacao_matricula, mensalidade_em_atraso, mensalidade_vence_hoje, etc.
 */

import type { MensalidadeReminderKind } from '../../shared/mensalidade-reminder-kind';

export type { MensalidadeReminderKind };

export type TwilioContentSids = {
    solicitacaoMatricula?: string;
    mensalidadeEmAtraso?: string;
    mensalidadeVenceHoje?: string;
    mensalidadeDisponivel?: string;
    /**
     * Template Twilio Content `boas_vindas` (WhatsApp) — variável `nome`.
     * Preferência: TWILIO_CONTENT_SID_BOAS_VINDAS; fallback: TWILIO_CONTENT_SID_NOTIFICATIONS_WELCOME.
     */
    boasVindas?: string;
    /** OTP / opt-in (alias legado TWILIO_WHATSAPP_MESSAGE_OPT_IN_CONTENT_SID) */
    messageOptIn?: string;
};

export function loadTwilioContentSidsFromEnv(): TwilioContentSids {
    return {
        solicitacaoMatricula: process.env.TWILIO_CONTENT_SID_SOLICITACAO_MATRICULA?.trim(),
        mensalidadeEmAtraso: process.env.TWILIO_CONTENT_SID_MENSALIDADE_EM_ATRASO?.trim(),
        mensalidadeVenceHoje: process.env.TWILIO_CONTENT_SID_MENSALIDADE_VENCE_HOJE?.trim(),
        mensalidadeDisponivel: process.env.TWILIO_CONTENT_SID_MENSALIDADE_DISPONIVEL?.trim(),
        boasVindas:
            process.env.TWILIO_CONTENT_SID_BOAS_VINDAS?.trim() ??
            process.env.TWILIO_CONTENT_SID_NOTIFICATIONS_WELCOME?.trim(),
        messageOptIn:
            process.env.TWILIO_CONTENT_SID_MESSAGE_OPT_IN?.trim() ??
            process.env.TWILIO_WHATSAPP_MESSAGE_OPT_IN_CONTENT_SID?.trim()
    };
}

export function resolveMensalidadeContentSid(
    kind: MensalidadeReminderKind,
    sids: TwilioContentSids
): string | undefined {
    switch (kind) {
        case 'overdue':
            return sids.mensalidadeEmAtraso;
        case 'due_today':
            return sids.mensalidadeVenceHoje;
        case 'upcoming':
            return sids.mensalidadeDisponivel;
        default:
            return undefined;
    }
}
