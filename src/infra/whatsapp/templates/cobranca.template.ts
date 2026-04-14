/**
 * Template de mensagem WhatsApp para notificação de cobrança.
 * Apenas texto com PIX copia e cola; código de barras/linha digitável como string simples (sem espaços ou pontuação).
 */

export interface CobrancaWhatsAppTemplateData {
    studentName: string;
    amount: string;
    dueDate: string;
    description: string;
    type: 'tuition' | 'enrollment' | 'plan';
    courseName?: string;
    /** PIX Copia e Cola – string exibida sem espaços nem pontuação */
    pixCopiaECola: string;
    /** Opcional: link para boleto/pagamento */
    boletoUrl?: string | null;
}

/** Remove espaços e pontuação (mantém apenas dígitos e letras). */
function toPlainCode(value: string): string {
    return (value ?? '').replace(/\s|[.\-_,;:]/g, '');
}

function getTypeLabel(type: CobrancaWhatsAppTemplateData['type']): string {
    return type === 'tuition' ? 'mensalidade' : type === 'enrollment' ? 'taxa de matrícula' : 'assinatura';
}

/**
 * Gera o corpo da mensagem WhatsApp para notificação de cobrança (somente PIX copia e cola).
 */
/**
 * Variáveis para templates Twilio Content (placeholders {{1}} … {{6}}).
 * Ajuste a ordem no template aprovado no Twilio para corresponder a estes índices,
 * ou use TWILIO_COBRANCA_CONTENT_USE_FULL_BODY no worker para enviar só {{1}} com o texto completo.
 */
export function getCobrancaTwilioContentVariables(data: CobrancaWhatsAppTemplateData): Record<string, string> {
    const pixCode = toPlainCode(data.pixCopiaECola);
    const typeLabel = getTypeLabel(data.type);
    return {
        '1': data.studentName?.trim() || 'Cliente',
        '2': data.amount?.trim() || '',
        '3': data.dueDate?.trim() || '',
        '4': data.description?.trim() || '',
        '5': pixCode || '-',
        '6': (data.boletoUrl ?? '').trim() || '-',
        '7': data.courseName?.trim() || '-',
        '8': typeLabel
    };
}

export function getCobrancaWhatsAppBody(data: CobrancaWhatsAppTemplateData): string {
    const greeting = data.studentName ? `Olá ${data.studentName}!` : 'Olá!';
    const typeLabel = getTypeLabel(data.type);
    const pixCode = toPlainCode(data.pixCopiaECola);

    const lines: string[] = [
        greeting,
        '',
        '📄 *Cobrança*',
        '',
        data.courseName ? `*Curso:* ${data.courseName}` : null,
        `*Descrição:* ${data.description}`,
        `*Valor:* ${data.amount}`,
        `*Vencimento:* ${data.dueDate}`,
        '',
        '*PIX Copia e Cola:*',
        pixCode || '(não informado)',
        '',
        data.boletoUrl?.trim() ? `Acesse: ${data.boletoUrl.trim()}` : null,
        data.boletoUrl?.trim() ? '' : null,
        `_Referente à ${typeLabel}. Pague até o vencimento._`,
        '',
        'Minha Aula',
    ].filter((line): line is string => line !== null);

    return lines.join('\n').trim();
}

/**
 * Retorna URLs de mídia para envio. Por enquanto vazio (sem QR code nem PDF).
 */
export function getCobrancaWhatsAppMediaUrls(_data: CobrancaWhatsAppTemplateData): string[] {
    return [];
}
