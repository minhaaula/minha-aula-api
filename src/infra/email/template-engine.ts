/**
 * Engine de renderização de templates de email
 * Suporta variáveis simples usando substituição de strings
 */

export interface EmailTemplateData {
    [key: string]: string | number | boolean | null | undefined;
}

export interface EmailTemplate {
    subject: string;
    html: string;
    text?: string;
}

export class EmailTemplateEngine {
    /**
     * Renderiza um template substituindo variáveis no formato {{variableName}}
     */
    static render(template: EmailTemplate, data: EmailTemplateData): EmailTemplate {
        const replaceVariables = (content: string): string => {
            return content.replace(/\{\{(\w+)\}\}/g, (match, key) => {
                const value = data[key];
                if (value === null || value === undefined) {
                    return match; // Mantém o placeholder se a variável não existir
                }
                return String(value);
            });
        };

        return {
            subject: replaceVariables(template.subject),
            html: replaceVariables(template.html),
            text: template.text ? replaceVariables(template.text) : undefined
        };
    }

    /**
     * Valida se todas as variáveis necessárias estão presentes
     */
    static validateVariables(template: EmailTemplate, data: EmailTemplateData): string[] {
        const requiredVars: string[] = [];
        const regex = /\{\{(\w+)\}\}/g;
        
        const extractVars = (content: string): Set<string> => {
            const vars = new Set<string>();
            let match;
            while ((match = regex.exec(content)) !== null) {
                vars.add(match[1]);
            }
            return vars;
        };

        const allVars = new Set([
            ...extractVars(template.subject),
            ...extractVars(template.html),
            ...(template.text ? extractVars(template.text) : [])
        ]);

        for (const varName of allVars) {
            if (!(varName in data) || data[varName] === null || data[varName] === undefined) {
                requiredVars.push(varName);
            }
        }

        return requiredVars;
    }
}




