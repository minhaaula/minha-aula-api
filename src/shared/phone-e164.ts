/**
 * Normaliza número de telefone brasileiro para formato E.164 (ex: +5511999999999).
 * Usado por integrações como Twilio WhatsApp.
 */

/**
 * Normaliza telefone BR para celular (DDD + 9 + 8 dígitos) quando necessário.
 */
function toBrazilianMobile(raw: string): string {
    const digits = raw.replace(/\D/g, '');
    if (digits.length === 10) {
        return digits.slice(0, 2) + '9' + digits.slice(2);
    }
    if (digits.length >= 11 && digits[2] !== '9') {
        return digits.slice(0, 2) + '9' + digits.slice(2, 11);
    }
    if (digits.length >= 11) {
        return digits.slice(0, 11);
    }
    return digits;
}

/**
 * Converte número brasileiro para E.164 (ex: 11999999999 -> +5511999999999).
 * Assume Brasil (+55) se o número não começar com +.
 */
export function toE164Brazil(raw: string): string {
    const s = (raw ?? '').toString().trim();
    if (!s) return '';
    let digits = s.replace(/\D/g, '');
    if (s.startsWith('+')) {
        if (digits.startsWith('55') && digits.length >= 12) return '+' + digits.slice(0, 13);
        if (!digits.startsWith('55') && digits.length >= 10) return '+55' + digits.slice(-11);
        return digits ? '+' + digits : '';
    }
    // Número já com DDI 55: não passar por toBrazilianMobile (55 seria tratado como DDD)
    if (digits.startsWith('55') && digits.length >= 12) {
        return '+' + digits.slice(0, 13);
    }
    const mobile = toBrazilianMobile(s);
    digits = mobile.replace(/\D/g, '');
    if (digits.length < 10) return '';
    const withCountry = digits.startsWith('55') ? digits.slice(0, 13) : '55' + digits.slice(-11);
    return '+' + withCountry;
}
