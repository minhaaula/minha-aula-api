import { EmailTemplate } from '../template-engine';
import { buildBaseEmailHtml } from './base-template';

export interface BoletoNotificationTemplateData {
    studentName: string;
    boletoUrl: string;
    digitableLine?: string | null;
    amount: string; // Valor formatado (ex: "R$ 150,00")
    dueDate: string; // Data formatada (ex: "15/01/2024")
    description: string;
    type: 'tuition' | 'enrollment' | 'plan'; // Tipo de boleto
    courseName?: string; // Para mensalidades
}

export function getBoletoNotificationTemplate(data: BoletoNotificationTemplateData): EmailTemplate {
    const userName = data.studentName ? `Olá ${data.studentName},` : 'Olá,';
    
    const typeLabel = data.type === 'tuition' 
        ? 'mensalidade' 
        : data.type === 'enrollment' 
        ? 'taxa de matrícula' 
        : 'assinatura';
    
    const content = `
        <p>${userName}</p>
        <p>Um novo boleto foi gerado para você!</p>
        ${data.courseName ? `<p><strong>Curso:</strong> ${data.courseName}</p>` : ''}
        <p><strong>Descrição:</strong> ${data.description}</p>
        <p><strong>Valor:</strong> ${data.amount}</p>
        <p><strong>Vencimento:</strong> ${data.dueDate}</p>
        ${data.digitableLine ? `
        <p><strong>Linha digitável:</strong></p>
        <div class="code">${data.digitableLine}</div>
        ` : ''}
        <p style="text-align: center; margin: 30px 0;">
            <a href="${data.boletoUrl}" class="button" style="background-color: #27ae60; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">
                Visualizar Boleto
            </a>
        </p>
        <p>Ou copie e cole o link abaixo no seu navegador:</p>
        <div class="code">${data.boletoUrl}</div>
        <p><strong>Importante:</strong> Este boleto é referente à ${typeLabel}. Certifique-se de realizar o pagamento até a data de vencimento para evitar atrasos.</p>
    `;

    const textContent = `${userName}\n\nUm novo boleto foi gerado para você!\n\n${data.courseName ? `Curso: ${data.courseName}\n` : ''}Descrição: ${data.description}\nValor: ${data.amount}\nVencimento: ${data.dueDate}\n${data.digitableLine ? `\nLinha digitável: ${data.digitableLine}\n` : ''}\nAcesse o boleto em: ${data.boletoUrl}\n\nImportante: Este boleto é referente à ${typeLabel}. Certifique-se de realizar o pagamento até a data de vencimento para evitar atrasos.`;

    return {
        subject: `Boleto Gerado - ${data.description}`,
        html: buildBaseEmailHtml({
            title: 'Boleto Gerado',
            content,
            footerText: 'Este é um email automático, por favor não responda.',
            companyName: 'Payments API'
        }),
        text: textContent
    };
}







