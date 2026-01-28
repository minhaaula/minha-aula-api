/**
 * Utilitário para sanitizar dados sensíveis antes de logar
 */

const SENSITIVE_FIELDS = [
    'password',
    'passwordHash',
    'token',
    'access_token',
    'apiKey',
    'accountApiKey',
    'cpf',
    'cnpj',
    'email',
    'phone',
    'secret',
    'authorization',
    'authorizationToken',
    'authToken',
    'resetToken',
    'serviceAccount',
    'privateKey',
    'clientSecret',
    'apiSecret'
];

const SENSITIVE_PATTERNS = [
    /password/i,
    /token/i,
    /secret/i,
    /key/i,
    /cpf/i,
    /cnpj/i,
    /authorization/i,
    /credential/i
];

/**
 * Sanitiza um objeto removendo ou mascarando campos sensíveis
 */
export function sanitizeForLogging(data: unknown, depth = 0): unknown {
    // Limitar profundidade para evitar loops infinitos
    if (depth > 10) {
        return '[Max depth reached]';
    }

    if (data === null || data === undefined) {
        return data;
    }

    if (typeof data === 'string') {
        // Se for muito longo, truncar
        if (data.length > 500) {
            return data.substring(0, 500) + '...[truncated]';
        }
        return data;
    }

    if (typeof data !== 'object') {
        return data;
    }

    if (Array.isArray(data)) {
        return data.map(item => sanitizeForLogging(item, depth + 1));
    }

    const sanitized: Record<string, unknown> = {};
    
    for (const [key, value] of Object.entries(data)) {
        const lowerKey = key.toLowerCase();
        
        // Verificar se o campo é sensível
        const isSensitive = SENSITIVE_FIELDS.some(field => 
            lowerKey.includes(field.toLowerCase())
        ) || SENSITIVE_PATTERNS.some(pattern => 
            pattern.test(key)
        );

        if (isSensitive) {
            // Mascarar valores sensíveis
            if (typeof value === 'string' && value.length > 0) {
                if (value.length <= 4) {
                    sanitized[key] = '***';
                } else {
                    sanitized[key] = value.substring(0, 2) + '***' + value.substring(value.length - 2);
                }
            } else {
                sanitized[key] = '***';
            }
        } else if (key === 'body' && typeof value === 'object') {
            // Sanitizar body de requisições especialmente
            sanitized[key] = sanitizeForLogging(value, depth + 1);
        } else {
            sanitized[key] = sanitizeForLogging(value, depth + 1);
        }
    }

    return sanitized;
}

/**
 * Sanitiza um objeto mantendo apenas campos seguros para logging
 */
export function sanitizeObject(obj: unknown): Record<string, unknown> {
    const sanitized = sanitizeForLogging(obj);
    return typeof sanitized === 'object' && sanitized !== null && !Array.isArray(sanitized)
        ? sanitized as Record<string, unknown>
        : {};
}
