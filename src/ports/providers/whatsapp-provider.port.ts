/**
 * Port para envio de mensagens WhatsApp.
 * Implementações: Twilio (infra/providers/twilio/whatsapp-provider.ts).
 */

export interface SendWhatsAppInput {
    /** Número no formato E.164 (ex: +5511999999999) ou brasileiro (ex: 11999999999) */
    to: string;
    /** Corpo da mensagem de texto */
    body: string;
    /**
     * URLs de mídia (imagem, PDF, etc.). O Twilio envia uma mídia por mensagem:
     * primeira mensagem = body + primeira URL (se for imagem); em seguida uma mensagem por URL extra.
     */
    mediaUrls?: string[];
}

export interface WhatsAppProviderPort {
    sendMessage(input: SendWhatsAppInput): Promise<void>;
}
