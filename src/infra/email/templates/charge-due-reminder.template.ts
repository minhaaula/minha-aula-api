import { EmailTemplate } from '../template-engine';
import { buildBaseEmailHtml } from './base-template';

export interface ChargeDueReminderTemplateData {
    recipientName: string;
    description: string;
    amount: string;
    dueDate: string;
    type: 'tuition' | 'enrollment' | 'plan';
    courseName?: string;
    boletoUrl?: string | null;
}

export function getChargeDueReminderTemplate(data: ChargeDueReminderTemplateData): EmailTemplate {
    const userName = data.recipientName ? `Olá ${data.recipientName},` : 'Olá,';

    const typeLabel =
        data.type === 'tuition'
            ? 'mensalidade'
            : data.type === 'enrollment'
              ? 'taxa de matrícula'
              : 'assinatura';

    const content = `
        <p>${userName}</p>
        <p><strong>Lembrete:</strong> Uma cobrança está próxima do vencimento.</p>
        ${data.courseName ? `<p><strong>Curso:</strong> ${data.courseName}</p>` : ''}
        <p><strong>Descrição:</strong> ${data.description}</p>
        <p><strong>Valor:</strong> ${data.amount}</p>
        <p><strong>Data de vencimento:</strong> ${data.dueDate}</p>
        ${
            data.boletoUrl
                ? `
        <p style="text-align: center; margin: 30px 0;">
            <a href="${data.boletoUrl}" class="button" style="background-color: #e67e22; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">
                Ver Boleto / Pagar
            </a>
        </p>
        <p>Ou acesse: <span class="code">${data.boletoUrl}</span></p>
        `
                : ''
        }
        <p><strong>Importante:</strong> Esta cobrança é referente à ${typeLabel}. Realize o pagamento até a data de vencimento para evitar atrasos.</p>
    `;

    const textContent = `${userName}\n\nLembrete: Uma cobrança está próxima do vencimento.\n\n${
        data.courseName ? `Curso: ${data.courseName}\n` : ''
    }Descrição: ${data.description}\nValor: ${data.amount}\nVencimento: ${data.dueDate}\n${
        data.boletoUrl ? `\nAcesse o boleto: ${data.boletoUrl}\n` : ''
    }\nEsta cobrança é referente à ${typeLabel}. Realize o pagamento até a data de vencimento para evitar atrasos.`;

    return {
        subject: `Lembrete: cobrança vence em breve - ${data.description}`,
        html: buildBaseEmailHtml({
            title: 'Lembrete de vencimento',
            content,
            footerText: 'Este é um email automático, por favor não responda.',
            companyName: 'Minha Aula'
        }),
        text: textContent
    };
}
