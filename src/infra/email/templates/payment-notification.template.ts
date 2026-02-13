import { EmailTemplate } from '../template-engine';

const COMPANY_YEAR = '© 2025 Minha Aula Admin. Todos os direitos reservados.';

export interface PaymentNotificationTemplateData {
    userName: string;
    amount: string;
    paymentDate: string;
    paymentMethod: string;
    transactionId: string;
    invoiceUrl: string;
}

function replaceVariables(template: string, variables: Record<string, string>): string {
    let result = template;
    for (const [key, value] of Object.entries(variables)) {
        result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
    }
    return result;
}

export function getPaymentNotificationTemplate(data: PaymentNotificationTemplateData): EmailTemplate {
    const html = replaceVariables(
        `<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Pagamento Confirmado</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f3f4f6;">
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f3f4f6;">
        <tr>
            <td align="center" style="padding: 40px 20px;">
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="max-width: 600px; background-color: #ffffff; border-radius: 8px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
                    <tr>
                        <td align="center" style="padding: 40px 40px 20px; background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); border-radius: 8px 8px 0 0;">
                            <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 600;">💳 Pagamento Confirmado</h1>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 40px;">
                            <p style="margin: 0 0 20px; color: #374151; font-size: 16px; line-height: 1.6;">Olá <strong>{{userName}}</strong>,</p>
                            <p style="margin: 0 0 30px; color: #374151; font-size: 16px; line-height: 1.6;">Seu pagamento foi processado com sucesso! 🎉</p>
                            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #fffbeb; border: 1px solid #fde68a; border-radius: 6px; margin: 20px 0;">
                                <tr>
                                    <td style="padding: 20px;">
                                        <p style="margin: 0 0 15px; color: #92400e; font-size: 16px; font-weight: 600;">Detalhes do Pagamento</p>
                                        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                            <tr>
                                                <td style="padding: 8px 0; color: #78350f; font-size: 14px;"><strong>Valor:</strong></td>
                                                <td align="right" style="padding: 8px 0; color: #78350f; font-size: 14px; font-weight: 600;">{{amount}}</td>
                                            </tr>
                                            <tr>
                                                <td style="padding: 8px 0; color: #78350f; font-size: 14px;"><strong>Data:</strong></td>
                                                <td align="right" style="padding: 8px 0; color: #78350f; font-size: 14px;">{{paymentDate}}</td>
                                            </tr>
                                            <tr>
                                                <td style="padding: 8px 0; color: #78350f; font-size: 14px;"><strong>Método:</strong></td>
                                                <td align="right" style="padding: 8px 0; color: #78350f; font-size: 14px;">{{paymentMethod}}</td>
                                            </tr>
                                            <tr>
                                                <td style="padding: 8px 0; color: #78350f; font-size: 14px;"><strong>Referência:</strong></td>
                                                <td align="right" style="padding: 8px 0; color: #78350f; font-size: 14px; font-family: monospace;">{{transactionId}}</td>
                                            </tr>
                                        </table>
                                    </td>
                                </tr>
                            </table>
                            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                <tr>
                                    <td align="center" style="padding: 20px 0 0;">
                                        <a href="{{invoiceUrl}}" style="display: inline-block; padding: 14px 32px; background-color: #f59e0b; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px;">Ver Recibo</a>
                                    </td>
                                </tr>
                            </table>
                            <p style="margin: 30px 0 0; color: #6b7280; font-size: 14px; line-height: 1.6;">Obrigado pela sua confiança em nossos serviços!</p>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 30px 40px; background-color: #f9fafb; border-top: 1px solid #e5e7eb; border-radius: 0 0 8px 8px;">
                            <p style="margin: 0 0 10px; color: #6b7280; font-size: 14px; text-align: center;">Em caso de dúvidas sobre este pagamento, entre em contato conosco.</p>
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
            amount: data.amount,
            paymentDate: data.paymentDate,
            paymentMethod: data.paymentMethod,
            transactionId: data.transactionId,
            invoiceUrl: data.invoiceUrl
        }
    );

    const text = `Olá ${data.userName},\n\nSeu pagamento foi processado com sucesso!\n\nDetalhes do Pagamento:\nValor: ${data.amount}\nData: ${data.paymentDate}\nMétodo: ${data.paymentMethod}\nReferência: ${data.transactionId}\n\nVer recibo: ${data.invoiceUrl}\n\nObrigado pela sua confiança em nossos serviços!`;

    return {
        subject: 'Pagamento Confirmado',
        html,
        text
    };
}
