import { EmailTemplate } from '../template-engine';

const COMPANY_YEAR = '© 2025 Minha Aula. Todos os direitos reservados.';

export interface EnrollmentRequestRejectedTemplateData {
    studentName: string;
    schoolName: string;
    courseName: string;
    className?: string;
    loginUrl?: string;
    notes?: string | null;
}

function replaceVariables(template: string, variables: Record<string, string>): string {
    let result = template;
    for (const [key, value] of Object.entries(variables)) {
        result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
    }
    return result;
}

export function getEnrollmentRequestRejectedTemplate(data: EnrollmentRequestRejectedTemplateData): EmailTemplate {
    const className = data.className ?? '—';
    const loginUrl = data.loginUrl ?? '#';
    const notesBlock =
        data.notes && data.notes.trim()
            ? `<p style="margin: 0 0 24px; color: #374151; font-size: 15px;"><strong>Observação:</strong> ${escapeHtml(data.notes.trim())}</p>`
            : '';

    const html = replaceVariables(
        `<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Pedido de matrícula recusado</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f3f4f6;">
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f3f4f6;">
        <tr>
            <td align="center" style="padding: 40px 20px;">
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="max-width: 600px; background-color: #ffffff; border-radius: 8px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
                    <tr>
                        <td align="center" style="padding: 40px 40px 20px; background: linear-gradient(135deg, #6b7280 0%, #4b5563 100%); border-radius: 8px 8px 0 0;">
                            <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 600;">Pedido recusado</h1>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 32px 40px;">
                            <p style="margin: 0 0 16px; color: #374151; font-size: 16px; line-height: 1.6;">Olá, {{studentName}},</p>
                            <p style="margin: 0 0 16px; color: #374151; font-size: 16px; line-height: 1.6;">Você recusou o pedido de matrícula em <strong>{{schoolName}}</strong>.</p>
                            <p style="margin: 0 0 8px; color: #111827; font-size: 15px;"><strong>Curso:</strong> {{courseName}}</p>
                            <p style="margin: 0 0 24px; color: #111827; font-size: 15px;"><strong>Turma:</strong> {{className}}</p>
                            ${notesBlock}
                            <a href="{{loginUrl}}" style="display: inline-block; padding: 12px 24px; background-color: #2563eb; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 600;">Abrir aplicativo</a>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 24px 40px; border-top: 1px solid #e5e7eb; color: #9ca3af; font-size: 12px; text-align: center;">
                            ${COMPANY_YEAR}
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>`,
        {
            studentName: data.studentName,
            schoolName: data.schoolName,
            courseName: data.courseName,
            className,
            loginUrl
        }
    );

    const textNotes = data.notes?.trim() ? `\nObservação: ${data.notes.trim()}\n` : '';
    const text = `Olá, ${data.studentName},\n\nVocê recusou o pedido de matrícula em ${data.schoolName}.\n\nCurso: ${data.courseName}\nTurma: ${className}${textNotes}\n${loginUrl}\n`;

    return {
        subject: `Pedido de matrícula recusado — ${data.schoolName}`,
        html,
        text
    };
}

function escapeHtml(s: string): string {
    return s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}
