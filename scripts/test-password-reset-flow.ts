import 'dotenv/config';
import 'reflect-metadata';
import { AppDataSource } from '../src/infra/db/typeorm/datasource';
import { UserRepositoryAdapter } from '../src/infra/db/typeorm/user-repository.adapter';
import { PasswordResetTokenRepositoryAdapter } from '../src/infra/db/typeorm/password-reset-token-repository.adapter';
import { RequestUserPasswordReset } from '../src/app/use-cases/auth/request-user-password-reset';
import { ResetUserPassword } from '../src/app/use-cases/auth/reset-user-password';
import { ScryptPasswordHasher } from '../src/infra/auth/scrypt-password-hasher';
import { NodemailerEmailProvider } from '../src/infra/providers/nodemailer/email-provider';
import { User } from '../src/domain/entities/user';
import { Email } from '../src/domain/value-objects/email';
import { PostalAddress } from '../src/domain/value-objects/postal-address';
import { Uuid } from '../src/shared/uuid';

// Mock do EmailProvider que captura os emails enviados
class CapturingEmailProvider extends NodemailerEmailProvider {
    public sentEmails: Array<{ to: string; subject: string; html: string; text?: string }> = [];

    async sendEmail(input: { to: string; subject: string; html: string; text?: string }): Promise<void> {
        this.sentEmails.push(input);
        // Também envia o email real
        await super.sendEmail(input);
    }

    clear() {
        this.sentEmails = [];
    }
}

async function testPasswordResetFlow() {
    console.log('🧪 Iniciando teste do fluxo completo de reset de senha...\n');

    try {
        // Inicializar banco de dados
        if (!AppDataSource.isInitialized) {
            await AppDataSource.initialize();
            console.log('✅ Banco de dados conectado');
        }

        // Configurar repositórios e providers
        const usersRepo = new UserRepositoryAdapter();
        const tokensRepo = new PasswordResetTokenRepositoryAdapter();
        const passwordHasher = new ScryptPasswordHasher();

        // Configurar email provider
        const emailHost = process.env.EMAIL_HOST;
        const emailPort = process.env.EMAIL_PORT;
        const emailUser = process.env.EMAIL_USER;
        const emailPass = process.env.EMAIL_PASS;
        const frontendBaseUrl = process.env.FRONTEND_BASE_URL;

        if (!emailHost || !emailPort || !emailUser || !emailPass) {
            throw new Error('Variáveis de email não configuradas! Configure EMAIL_HOST, EMAIL_PORT, EMAIL_USER, EMAIL_PASS');
        }

        const emailProvider = new CapturingEmailProvider({
            host: emailHost,
            port: Number(emailPort),
            auth: {
                user: emailUser,
                pass: emailPass
            },
            from: process.env.EMAIL_FROM || 'noreply@payments-api.com'
        });

        console.log('✅ EmailProvider configurado\n');

        // Criar ou buscar usuário de teste
        const testEmail = `test-reset-${Date.now()}@test.com`;
        const testPassword = 'senhaAntiga123';
        const newPassword = 'novaSenha456';

        console.log('📝 Criando usuário de teste...');
        const testUser = User.create({
            id: Uuid(),
            fullName: 'Usuário Teste Reset',
            birthDate: new Date('1990-01-01'),
            email: Email.create(testEmail),
            phone: '11987654321',
            cpf: `${Date.now().toString().slice(-11)}`,
            address: PostalAddress.create({
                street: 'Rua Teste',
                number: '123',
                city: 'São Paulo',
                state: 'SP',
                zipCode: '01234000'
            }),
            persona: 'STUDENT',
            passwordHash: await passwordHasher.hash(testPassword),
            createdAt: new Date()
        });

        // Verificar se usuário já existe
        const existingUser = await usersRepo.findByEmail(testEmail);
        if (existingUser) {
            console.log('⚠️  Usuário de teste já existe, usando existente');
        } else {
            await usersRepo.save(testUser);
            console.log(`✅ Usuário criado: ${testEmail}`);
        }

        const userToTest = existingUser || testUser;
        console.log('');

        // Etapa 1: Solicitar reset de senha
        console.log('📧 Etapa 1: Solicitando reset de senha...');
        const requestReset = new RequestUserPasswordReset(
            usersRepo,
            tokensRepo,
            emailProvider,
            frontendBaseUrl
        );

        emailProvider.clear();
        const requestResult = await requestReset.exec({ email: userToTest.email.value });
        console.log(`✅ Resposta: ${requestResult.message}`);

        // Verificar se email foi enviado
        if (emailProvider.sentEmails.length === 0) {
            throw new Error('❌ Email não foi enviado!');
        }

        const sentEmail = emailProvider.sentEmails[0];
        console.log(`✅ Email enviado para: ${sentEmail.to}`);
        console.log(`   Assunto: ${sentEmail.subject}`);

        // Extrair token do email
        let resetToken: string | undefined;
        
        // Tentar extrair do HTML (link)
        const htmlMatch = sentEmail.html.match(/reset-password\?token=([a-f0-9]{64})/);
        if (htmlMatch) {
            resetToken = htmlMatch[1];
            console.log(`✅ Token extraído do link HTML`);
        } else {
            // Tentar extrair do texto (formato: "Use este token: abc123...")
            const textMatch = sentEmail.text?.match(/Use este token:\s*([a-f0-9]{64})/i);
            if (textMatch) {
                resetToken = textMatch[1];
                console.log(`✅ Token extraído do texto do email`);
            } else {
                // Tentar extrair qualquer token hexadecimal de 64 caracteres
                const anyTokenMatch = sentEmail.text?.match(/([a-f0-9]{64})/);
                if (anyTokenMatch) {
                    resetToken = anyTokenMatch[1];
                    console.log(`✅ Token extraído do email (formato alternativo)`);
                }
            }
        }

        if (!resetToken) {
            // Se não conseguir extrair, usar o token retornado em dev mode (se disponível)
            if (requestResult.token) {
                resetToken = requestResult.token;
                console.log('✅ Token obtido do modo desenvolvimento');
            } else {
                // Última tentativa: buscar diretamente no banco pelo email
                console.log('⚠️  Tentando buscar token no banco de dados...');
                // Como não temos método para buscar por email, vamos tentar extrair de outra forma
                // Vamos procurar no HTML por qualquer string hexadecimal longa
                const longHexMatch = sentEmail.html.match(/([a-f0-9]{32,64})/);
                if (longHexMatch) {
                    resetToken = longHexMatch[1];
                    console.log(`✅ Token encontrado no HTML (heurística)`);
                } else {
                    throw new Error('❌ Não foi possível obter o token de reset! Verifique o email no Mailtrap.');
                }
            }
        }

        console.log(`✅ Token obtido: ${resetToken.substring(0, 20)}...${resetToken.substring(resetToken.length - 4)}`);

        console.log('');

        // Etapa 2: Resetar senha com o token
        console.log('🔐 Etapa 2: Resetando senha com o token...');
        const resetPassword = new ResetUserPassword(usersRepo, tokensRepo, passwordHasher);
        
        const resetResult = await resetPassword.exec({
            token: resetToken!,
            newPassword: newPassword
        });

        console.log(`✅ ${resetResult.message}`);
        console.log('');

        // Etapa 3: Verificar se a senha foi alterada
        console.log('🔍 Etapa 3: Verificando se a senha foi alterada...');
        const updatedUser = await usersRepo.findByEmail(userToTest.email.value);
        
        if (!updatedUser) {
            throw new Error('❌ Usuário não encontrado após reset!');
        }

        const oldPasswordValid = await passwordHasher.compare(testPassword, updatedUser.passwordHash);
        const newPasswordValid = await passwordHasher.compare(newPassword, updatedUser.passwordHash);

        if (oldPasswordValid) {
            throw new Error('❌ Senha antiga ainda funciona! Reset não funcionou.');
        }

        if (!newPasswordValid) {
            throw new Error('❌ Nova senha não funciona! Reset não funcionou.');
        }

        console.log('✅ Senha antiga não funciona mais');
        console.log('✅ Nova senha funciona corretamente');
        console.log('');

        // Etapa 4: Verificar que o token não pode ser reutilizado
        console.log('🔄 Etapa 4: Verificando que o token não pode ser reutilizado...');
        try {
            await resetPassword.exec({
                token: resetToken!,
                newPassword: 'outraSenha789'
            });
            throw new Error('❌ Token foi aceito novamente! Deveria ter sido marcado como usado.');
        } catch (error: any) {
            if (error.message.includes('Token inválido ou expirado')) {
                console.log('✅ Token corretamente marcado como usado e não pode ser reutilizado');
            } else {
                throw error;
            }
        }

        console.log('');
        console.log('🎉 Teste completo do fluxo de reset de senha PASSOU!');
        console.log('');
        console.log('📋 Resumo:');
        console.log(`   ✅ Email enviado para: ${sentEmail.to}`);
        console.log(`   ✅ Token gerado e salvo`);
        console.log(`   ✅ Senha resetada com sucesso`);
        console.log(`   ✅ Senha antiga não funciona mais`);
        console.log(`   ✅ Nova senha funciona corretamente`);
        console.log(`   ✅ Token não pode ser reutilizado`);
        console.log('');
        console.log('📬 Verifique a caixa de entrada do Mailtrap para ver o email:');
        console.log('   https://mailtrap.io/inboxes');

    } catch (error: any) {
        console.error('\n❌ Erro no teste:', error.message);
        if (error.stack) {
            console.error(error.stack);
        }
        process.exit(1);
    } finally {
        if (AppDataSource.isInitialized) {
            await AppDataSource.destroy();
            console.log('\n🔌 Conexão com banco de dados fechada');
        }
    }
}

testPasswordResetFlow();

