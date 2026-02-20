import { EmailTemplate } from '../template-engine';

const COMPANY_YEAR = '© 2025 Minha Aula. Todos os direitos reservados.';

export interface EmailConfirmationTemplateData {
    userName: string;
    confirmationUrl: string;
}

function replaceVariables(template: string, variables: Record<string, string>): string {
    let result = template;
    for (const [key, value] of Object.entries(variables)) {
        result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
    }
    return result;
}

export function getEmailConfirmationTemplate(data: EmailConfirmationTemplateData): EmailTemplate {
    const html = replaceVariables(
        `<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Confirme seu Email</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f3f4f6;">
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f3f4f6;">
        <tr>
            <td align="center" style="padding: 40px 20px;">
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="max-width: 600px; background-color: #ffffff; border-radius: 8px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
                    <tr>
                        <td align="center" style="padding: 40px 40px 20px; background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%); border-radius: 8px 8px 0 0;">
                            <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 600;">✉️ Confirme seu Email</h1>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 40px;">
                            <p style="margin: 0 0 20px; color: #374151; font-size: 16px; line-height: 1.6;">Olá <strong>{{userName}}</strong>,</p>
                            <p style="margin: 0 0 20px; color: #374151; font-size: 16px; line-height: 1.6;">Obrigado por se cadastrar! Para completar seu cadastro e ativar sua conta, precisamos confirmar seu endereço de email.</p>
                            <p style="margin: 0 0 30px; color: #374151; font-size: 16px; line-height: 1.6;">Clique no botão abaixo para confirmar:</p>
                            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                <tr>
                                    <td align="center" style="padding: 0 0 30px;">
                                        <a href="{{confirmationUrl}}" style="display: inline-block; padding: 14px 32px; background-color: #8b5cf6; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px;">Confirmar Email</a>
                                    </td>
                                </tr>
                            </table>
                            <p style="margin: 0 0 20px; color: #6b7280; font-size: 14px; line-height: 1.6;">Ou copie e cole este link no seu navegador:</p>
                            <p style="margin: 0 0 30px; color: #8b5cf6; font-size: 14px; word-break: break-all;">{{confirmationUrl}}</p>
                            <p style="margin: 0 0 10px; color: #6b7280; font-size: 14px; line-height: 1.6;">Este link expira em <strong>48 horas</strong>.</p>
                            <p style="margin: 20px 0 0; color: #6b7280; font-size: 14px; line-height: 1.6;">Se você não criou uma conta, pode ignorar este email com segurança.</p>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 30px 40px; background-color: #f9fafb; border-top: 1px solid #e5e7eb; border-radius: 0 0 8px 8px;">
                            <p style="margin: 0 0 10px; color: #6b7280; font-size: 14px; text-align: center;">Precisa de ajuda? Entre em contato conosco.</p>
                            <p style="margin: 0; color: #9ca3af; font-size: 12px; text-align: center;">${COMPANY_YEAR}</p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>`,
        {
            userName: data.userName,
            confirmationUrl: data.confirmationUrl
        }
    );

    const text = `Olá ${data.userName},\n\nObrigado por se cadastrar! Para completar seu cadastro e ativar sua conta, confirme seu email acessando:\n\n${data.confirmationUrl}\n\nEste link expira em 48 horas.\n\nSe você não criou uma conta, pode ignorar este email com segurança.`;

    return {
        subject: 'Confirme seu Email',
        html,
        text
    };
}
