import { EmailTemplate } from '../template-engine';
import { buildBaseEmailHtml } from './base-template';

export interface WelcomeTemplateData {
    userName: string;
    loginUrl?: string;
}

export function getWelcomeTemplate(data: WelcomeTemplateData): EmailTemplate {
    const content = `
        <p>Olá <strong>${data.userName}</strong>,</p>
        <p>Bem-vindo(a) ao Payments API!</p>
        <p>Sua conta foi criada com sucesso. Agora você pode acessar todas as funcionalidades da plataforma.</p>
        ${data.loginUrl ? `
        <p style="text-align: center;">
            <a href="${data.loginUrl}" class="button" style="background-color: #27ae60; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">
                Acessar Plataforma
            </a>
        </p>
        ` : ''}
        <p>Se você tiver alguma dúvida, nossa equipe de suporte está pronta para ajudar.</p>
        <p>Bem-vindo(a) novamente!</p>
    `;

    return {
        subject: 'Bem-vindo ao Payments API',
        html: buildBaseEmailHtml({
            title: 'Bem-vindo!',
            content,
            footerText: 'Este é um email automático, por favor não responda.',
            companyName: 'Payments API'
        }),
        text: `Olá ${data.userName},\n\nBem-vindo(a) ao Payments API!\n\nSua conta foi criada com sucesso. Agora você pode acessar todas as funcionalidades da plataforma.\n\n${data.loginUrl ? `Acesse: ${data.loginUrl}\n\n` : ''}Se você tiver alguma dúvida, nossa equipe de suporte está pronta para ajudar.\n\nBem-vindo(a) novamente!`
    };
}





