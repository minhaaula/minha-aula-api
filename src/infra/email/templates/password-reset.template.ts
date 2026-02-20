import { EmailTemplate } from '../template-engine';

const COMPANY_YEAR = '© 2025 Minha Aula. Todos os direitos reservados.';

export interface PasswordResetTemplateData {
    resetUrl: string;
    token?: string;
    expiresIn?: string;
    userName?: string;
}

function replaceVariables(template: string, variables: Record<string, string>): string {
    let result = template;
    for (const [key, value] of Object.entries(variables)) {
        result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
    }
    return result;
}

export function getPasswordResetTemplate(data: PasswordResetTemplateData): EmailTemplate {
    const html = replaceVariables(
        `<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Redefinir Senha</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f3f4f6;">
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f3f4f6;">
        <tr>
            <td align="center" style="padding: 40px 20px;">
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="max-width: 600px; background-color: #ffffff; border-radius: 8px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
                    <tr>
                        <td align="center" style="padding: 40px 40px 20px; background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); border-radius: 8px 8px 0 0;">
                            <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 600;">Redefinir Senha</h1>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 40px;">
                            <p style="margin: 0 0 20px; color: #374151; font-size: 16px; line-height: 1.6;">Olá,</p>
                            <p style="margin: 0 0 20px; color: #374151; font-size: 16px; line-height: 1.6;">Recebemos uma solicitação para redefinir a senha da sua conta. Se você não fez esta solicitação, pode ignorar este email com segurança.</p>
                            <p style="margin: 0 0 30px; color: #374151; font-size: 16px; line-height: 1.6;">Para redefinir sua senha, clique no botão abaixo:</p>
                            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                <tr>
                                    <td align="center" style="padding: 0 0 30px;">
                                        <a href="{{resetUrl}}" style="display: inline-block; padding: 14px 32px; background-color: #2563eb; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px;">Redefinir Senha</a>
                                    </td>
                                </tr>
                            </table>
                            <p style="margin: 0 0 20px; color: #6b7280; font-size: 14px; line-height: 1.6;">Ou copie e cole este link no seu navegador:</p>
                            <p style="margin: 0 0 30px; color: #2563eb; font-size: 14px; word-break: break-all;">{{resetUrl}}</p>
                            <p style="margin: 0 0 10px; color: #6b7280; font-size: 14px; line-height: 1.6;">Este link expira em <strong>24 horas</strong> por motivos de segurança.</p>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 30px 40px; background-color: #f9fafb; border-top: 1px solid #e5e7eb; border-radius: 0 0 8px 8px;">
                            <p style="margin: 0 0 10px; color: #6b7280; font-size: 14px; text-align: center;">Se você não solicitou esta redefinição, ignore este email.</p>
                            <p style="margin: 0; color: #9ca3af; font-size: 12px; text-align: center;">${COMPANY_YEAR}</p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>`,
        { resetUrl: data.resetUrl }
    );

    const text = `Olá,\n\nRecebemos uma solicitação para redefinir a senha da sua conta. Se você não fez esta solicitação, pode ignorar este email com segurança.\n\nPara redefinir sua senha, acesse:\n\n${data.resetUrl}\n\nEste link expira em 24 horas por motivos de segurança.\n\nSe você não solicitou esta redefinição, ignore este email.`;

    return {
        subject: 'Redefinir Senha',
        html,
        text
    };
}
