import { EmailTemplate } from '../template-engine';

const COMPANY_YEAR = '© 2025 Minha Aula. Todos os direitos reservados.';

export interface WelcomeStudentTemplateData {
    userName: string;
    userEmail?: string;
    loginUrl?: string;
}

function replaceVariables(template: string, variables: Record<string, string>): string {
    let result = template;
    for (const [key, value] of Object.entries(variables)) {
        result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
    }
    return result;
}

export function getWelcomeStudentTemplate(data: WelcomeStudentTemplateData): EmailTemplate {
    const userEmail = data.userEmail ?? '';
    const loginUrl = data.loginUrl ?? '#';

    const html = replaceVariables(
        `<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Bem-vindo ao Minha Aula</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f3f4f6;">
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f3f4f6;">
        <tr>
            <td align="center" style="padding: 40px 20px;">
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="max-width: 600px; background-color: #ffffff; border-radius: 8px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
                    <tr>
                        <td align="center" style="padding: 40px 40px 20px; background: linear-gradient(135deg, #10b981 0%, #059669 100%); border-radius: 8px 8px 0 0;">
                            <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 600;">🎉 Bem-vindo, aluno!</h1>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 40px;">
                            <p style="margin: 0 0 20px; color: #374151; font-size: 16px; line-height: 1.6;">Olá <strong>{{userName}}</strong>,</p>
                            <p style="margin: 0 0 20px; color: #374151; font-size: 16px; line-height: 1.6;">Sua conta de aluno foi criada com sucesso no <strong>Minha Aula</strong>.</p>
                            <p style="margin: 0 0 30px; color: #374151; font-size: 16px; line-height: 1.6;">Agora você pode acessar a plataforma para acompanhar seus cursos, matrículas e pagamentos.</p>
                            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                <tr>
                                    <td align="center" style="padding: 0 0 30px;">
                                        <a href="{{loginUrl}}" style="display: inline-block; padding: 14px 32px; background-color: #10b981; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px;">Acessar minha conta</a>
                                    </td>
                                </tr>
                            </table>
                            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f0fdf4; border-left: 4px solid #10b981; border-radius: 4px; margin: 20px 0;">
                                <tr>
                                    <td style="padding: 20px;">
                                        <p style="margin: 0 0 10px; color: #065f46; font-size: 14px; font-weight: 600;">📋 Sua conta:</p>
                                        <p style="margin: 5px 0; color: #047857; font-size: 14px;"><strong>Email:</strong> {{userEmail}}</p>
                                    </td>
                                </tr>
                            </table>
                            <p style="margin: 30px 0 0; color: #6b7280; font-size: 14px; line-height: 1.6;">Se tiver alguma dúvida, nossa equipe de suporte está pronta para ajudar.</p>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 30px 40px; background-color: #f9fafb; border-top: 1px solid #e5e7eb; border-radius: 0 0 8px 8px;">
                            <p style="margin: 0 0 10px; color: #6b7280; font-size: 14px; text-align: center;">Obrigado por escolher o Minha Aula!</p>
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
            userEmail,
            loginUrl
        }
    );

    const text = `Olá ${data.userName},\n\nSua conta de aluno foi criada com sucesso no Minha Aula.\n\nAgora você pode acessar a plataforma para acompanhar seus cursos, matrículas e pagamentos.\n\n${loginUrl !== '#' ? `Acesse sua conta: ${loginUrl}\n\n` : ''}Sua conta:\nEmail: ${userEmail}\n\nSe tiver alguma dúvida, nossa equipe de suporte está pronta para ajudar.\n\nObrigado por escolher o Minha Aula!`;

    return {
        subject: 'Bem-vindo ao Minha Aula – Sua conta de aluno foi criada',
        html,
        text
    };
}
