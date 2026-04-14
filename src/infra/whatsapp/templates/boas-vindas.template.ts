/**
 * Variáveis do template Twilio Content `boas_vindas` (WhatsApp).
 * No Console Twilio o placeholder deve estar alinhado à chave `nome` em contentVariables.
 */

export function getBoasVindasTwilioContentVariables(nome: string): Record<string, string> {
    return { nome: (nome ?? '').trim() };
}
