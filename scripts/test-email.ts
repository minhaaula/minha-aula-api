import { NodemailerEmailProvider } from '../src/infra/providers/nodemailer/email-provider';
import * as dotenv from 'dotenv';

dotenv.config();

async function testEmail() {
    const emailHost = process.env.EMAIL_HOST;
    const emailPort = process.env.EMAIL_PORT;
    const emailUser = process.env.EMAIL_USER;
    const emailPass = process.env.EMAIL_PASS;

    console.log('Configuração de Email:');
    console.log('EMAIL_HOST:', emailHost || 'NÃO DEFINIDO');
    console.log('EMAIL_PORT:', emailPort || 'NÃO DEFINIDO');
    console.log('EMAIL_USER:', emailUser || 'NÃO DEFINIDO');
    console.log('EMAIL_PASS:', emailPass ? '***' : 'NÃO DEFINIDO');
    console.log('');

    if (!emailHost || !emailPort || !emailUser || !emailPass) {
        console.error('❌ Variáveis de ambiente não configuradas!');
        console.error('Configure as seguintes variáveis:');
        console.error('  EMAIL_HOST=sandbox.smtp.mailtrap.io');
        console.error('  EMAIL_PORT=2525');
        console.error('  EMAIL_USER=531358d981aee9');
        console.error('  EMAIL_PASS=118c0be95d226f');
        process.exit(1);
    }

    try {
        const emailProvider = new NodemailerEmailProvider({
            host: emailHost,
            port: Number(emailPort),
            auth: {
                user: emailUser,
                pass: emailPass
            },
            from: process.env.EMAIL_FROM || 'noreply@payments-api.com'
        });

        console.log('📧 Enviando email de teste...');
        
        await emailProvider.sendEmail({
            to: 'teste@example.com',
            subject: 'Teste de Email - Payments API',
            html: `
                <h2>Teste de Email</h2>
                <p>Este é um email de teste do sistema de redefinição de senha.</p>
                <p>Se você recebeu este email, a configuração está funcionando corretamente!</p>
            `,
            text: 'Este é um email de teste do sistema de redefinição de senha. Se você recebeu este email, a configuração está funcionando corretamente!'
        });

        console.log('✅ Email enviado com sucesso!');
        console.log('Verifique a caixa de entrada do Mailtrap para confirmar o recebimento.');
    } catch (error) {
        console.error('❌ Erro ao enviar email:', error);
        process.exit(1);
    }
}

testEmail();

