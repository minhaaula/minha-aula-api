import { EmailTemplate } from '../template-engine';
import { buildBaseEmailHtml } from './base-template';

export interface PasswordResetTemplateData {
    resetUrl: string;
    token?: string;
    expiresIn?: string;
    userName?: string;
}

export function getPasswordResetTemplate(data: PasswordResetTemplateData): EmailTemplate {
    const expiresIn = data.expiresIn || '1 hora';
    const userName = data.userName ? `Olá ${data.userName},` : 'Olá,';
    
    const content = `
        <p>${userName}</p>
        <p>Você solicitou a redefinição de senha da sua conta.</p>
        <p>Clique no botão abaixo para redefinir sua senha:</p>
        <p style="text-align: center;">
            <a href="${data.resetUrl}" class="button" style="background-color: #3498db; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">
                Redefinir Senha
            </a>
        </p>
        <p>Ou copie e cole o link abaixo no seu navegador:</p>
        <div class="code">${data.resetUrl}</div>
        ${data.token ? `
        <p><strong>Token de acesso:</strong></p>
        <div class="code">${data.token}</div>
        ` : ''}
        <p><strong>Este link expira em ${expiresIn}.</strong></p>
        <p>Se você não solicitou esta redefinição, ignore este email. Sua senha permanecerá inalterada.</p>
    `;

    return {
        subject: 'Redefinição de Senha',
        html: buildBaseEmailHtml({
            title: 'Redefinição de Senha',
            content,
            footerText: 'Este é um email automático, por favor não responda.',
            companyName: 'Payments API'
        }),
        text: `${userName}\n\nVocê solicitou a redefinição de senha da sua conta.\n\nAcesse o link abaixo para redefinir sua senha:\n\n${data.resetUrl}\n\n${data.token ? `Token de acesso: ${data.token}\n\n` : ''}Este link expira em ${expiresIn}.\n\nSe você não solicitou esta redefinição, ignore este email. Sua senha permanecerá inalterada.`
    };
}






