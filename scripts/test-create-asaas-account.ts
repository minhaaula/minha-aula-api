#!/usr/bin/env tsx
/**
 * Script para criar uma conta (subconta) na Asaas e verificar webhooks
 * 
 * Este script testa a criação de uma subconta na Asaas e verifica:
 * 1. Se a conta foi criada com sucesso
 * 2. Se o API token foi retornado
 * 3. Se os webhooks foram configurados
 * 4. Se as informações foram salvas no banco de dados (se externalReference for um ID de escola válido)
 * 
 * Uso:
 *   npm run test:asaas-account
 *   ou
 *   npx tsx scripts/test-create-asaas-account.ts
 * 
 * Variáveis de ambiente necessárias:
 *   - ASAAS_API_KEY: Chave de API principal da Asaas
 *   - ASAAS_BASE_URL: URL base da API (opcional, padrão: https://www.asaas.com/api/v3)
 *   - ASAAS_SUBACCOUNT_WEBHOOK_URL: URL base para webhooks (opcional)
 *   - ACCOUNT_EXTERNAL_REF: ID da escola (UUID) para salvar as informações no banco (opcional)
 */

import axios from 'axios';
import { AppDataSource } from '../src/infra/db/typeorm/datasource';
import { SchoolRepositoryAdapter } from '../src/infra/db/typeorm/school-repository';

// Função auxiliar para validar UUID
function isValidUUID(str: string): boolean {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRegex.test(str);
}

const ASAAS_API_KEY = process.env.ASAAS_API_KEY || '$aact_hmlg_000MzkwODA2MWY2OGM3MWRlMDU2NWM3MzJlNzZmNGZhZGY6OjNhOGRiN2NhLTc2ZGQtNDA4NC1iYzI4LTVmNzkzNDJkNjY1OTo6JGFhY2hfNjJjNzEzYmMtNGVkNS00YWU0LTg2NDYtN2FhM2VkMWMyM2Yw';
const ASAAS_BASE_URL = process.env.ASAAS_BASE_URL || 'https://api-sandbox.asaas.com/v3';
const WEBHOOK_BASE_URL = process.env.ASAAS_SUBACCOUNT_WEBHOOK_URL || process.env.WEBHOOK_BASE_URL || '';

interface AsaasSubAccountResponse {
    id: string;
    name: string;
    email: string;
    cpfCnpj?: string;
    personType?: string;
    companyType?: string;
    status?: string;
    externalReference?: string;
    apiKey?: string;
    walletId?: string;
}

interface AsaasWebhookResponse {
    id: string;
    name: string;
    url: string;
    email?: string;
    sendType?: string;
    enabled?: boolean;
    apiVersion?: number;
    events?: string[];
}

async function createAsaasAccount() {
    console.log('🏦 Teste de Criação de Conta na Asaas\n');
    console.log(`URL Base: ${ASAAS_BASE_URL}`);
    console.log(`API Key: ${ASAAS_API_KEY ? '✅ Fornecido' : '❌ Não fornecido'}`);
    console.log(`Webhook URL: ${WEBHOOK_BASE_URL || 'https://webhook.site/c19eab0f-3c21-4768-8a42-d43fb7c1be8f'}\n`);

    if (!ASAAS_API_KEY) {
        console.error('❌ Erro: ASAAS_API_KEY não fornecido');
        console.log('\nDefina a chave de API:');
        console.log('   export ASAAS_API_KEY="sua-chave-api-asaas"');
        process.exit(1);
    }

    // Preparar dados da conta de teste
    const baseAccountData = {
        name: process.env.ACCOUNT_NAME || 'Escola Teste ' + Date.now(),
        email: process.env.ACCOUNT_EMAIL || `teste-${Date.now()}@example.com`,
        cpfCnpj: process.env.ACCOUNT_CNPJ || '69603295000197', // CNPJ de teste
        phone: process.env.ACCOUNT_PHONE || '11988616889',
        companyType: process.env.ACCOUNT_COMPANY_TYPE || 'LIMITED',
        incomeValue: Number(process.env.ACCOUNT_INCOME_VALUE || '5000'),
        externalReference: process.env.ACCOUNT_EXTERNAL_REF || `test-${Date.now()}`,
        address: process.env.ACCOUNT_ADDRESS || 'Rua Teste',
        addressNumber: process.env.ACCOUNT_ADDRESS_NUMBER || '123',
        complement: process.env.ACCOUNT_COMPLEMENT || null,
        province: process.env.ACCOUNT_DISTRICT || 'Centro',
        postalCode: process.env.ACCOUNT_POSTAL_CODE || '01234567'
    };

    // Adicionar webhooks se configurado
    const accountData: any = { ...baseAccountData };
    if (WEBHOOK_BASE_URL) {
        accountData.webhooks = [
            {
                name: 'Webhook para cobranças',
                url: `${WEBHOOK_BASE_URL}/payments`,
                email: process.env.ASAAS_SUBACCOUNT_WEBHOOK_EMAIL || baseAccountData.email,
                sendType: 'SEQUENTIALLY' as const,
                interrupted: false,
                enabled: true,
                apiVersion: 3,
                authToken: process.env.ASAAS_SUBACCOUNT_WEBHOOK_AUTH_TOKEN || undefined,
                events: [
                    'PAYMENT_CREATED',
                    'PAYMENT_UPDATED',
                    'PAYMENT_CONFIRMED',
                    'PAYMENT_RECEIVED',
                    'PAYMENT_OVERDUE'
                ]
            },
            {
                name: 'Webhook para contas',
                url: `${WEBHOOK_BASE_URL}/accounts`,
                email: process.env.ASAAS_SUBACCOUNT_WEBHOOK_EMAIL || baseAccountData.email,
                sendType: 'SEQUENTIALLY' as const,
                interrupted: false,
                enabled: true,
                apiVersion: 3,
                authToken: process.env.ASAAS_SUBACCOUNT_WEBHOOK_AUTH_TOKEN || undefined,
                events: [
                    'ACCOUNT_STATUS_GENERAL_APPROVAL_APPROVED',
                    'ACCOUNT_STATUS_GENERAL_APPROVAL_REJECTED',
                    'ACCOUNT_STATUS_GENERAL_APPROVAL_AWAITING_APPROVAL',
                    'ACCOUNT_STATUS_GENERAL_APPROVAL_PENDING',
                    'ACCOUNT_CREATED'
                ]
            }
        ];
    }

        console.log('📝 Dados da conta a ser criada:');
        console.log(`   Nome: ${baseAccountData.name}`);
        console.log(`   Email: ${baseAccountData.email}`);
        console.log(`   CNPJ: ${baseAccountData.cpfCnpj}`);
        console.log(`   Telefone: ${baseAccountData.phone}`);
        console.log(`   Tipo: ${baseAccountData.companyType}`);
        console.log(`   Faturamento Mensal: R$ ${baseAccountData.incomeValue.toFixed(2)}`);
        console.log(`   Referência Externa: ${baseAccountData.externalReference}`);
        if (accountData.webhooks) {
            console.log(`   Webhooks: ${accountData.webhooks.length} configurado(s)`);
        }
        console.log('');

    try {
        // Criar conta na Asaas
        console.log('🔄 Criando conta na Asaas...');
        const createResponse = await axios.post<AsaasSubAccountResponse>(
            `${ASAAS_BASE_URL}/accounts`,
            accountData,
            {
                headers: {
                    'access_token': ASAAS_API_KEY,
                    'Content-Type': 'application/json'
                }
            }
        );

        const account = createResponse.data;

        console.log('✅ Conta criada com sucesso!\n');
        console.log('📊 Dados da Conta:');
        console.log(`   ID: ${account.id}`);
        console.log(`   Nome: ${account.name}`);
        console.log(`   Email: ${account.email}`);
        console.log(`   CNPJ: ${account.cpfCnpj || 'N/A'}`);
        console.log(`   Tipo de Pessoa: ${account.personType || 'N/A'}`);
        console.log(`   Tipo de Empresa: ${account.companyType || 'N/A'}`);
        console.log(`   Status: ${account.status || 'N/A'}`);
        console.log(`   Referência Externa: ${account.externalReference || 'N/A'}`);
        console.log(`   Wallet ID: ${account.walletId || 'N/A'}`);
        console.log('');

        if (account.apiKey) {
            console.log('🔑 API Token recebido!');
            console.log(`   API Key: ${account.apiKey}`);
            console.log('');
            console.log('⚠️  IMPORTANTE: Guarde este API Key em local seguro!');
            console.log('   Ele será usado para criar cobranças nesta conta.\n');
        } else {
            console.log('⚠️  API Token não foi retornado na criação da conta.');
            console.log('   Isso é normal - o token pode ser gerado posteriormente.\n');
        }

        // Verificar webhooks configurados
        if (account.id) {
            console.log('🔍 Verificando webhooks configurados...');
            try {
                const webhooksResponse = await axios.get<{ data: AsaasWebhookResponse[] }>(
                    `${ASAAS_BASE_URL}/accounts/${account.id}/webhooks`,
                    {
                        headers: {
                            'access_token': ASAAS_API_KEY,
                            'Content-Type': 'application/json'
                        }
                    }
                );

                const webhooks = webhooksResponse.data.data || [];
                console.log(`✅ Encontrados ${webhooks.length} webhook(s) configurado(s)\n`);

                webhooks.forEach((webhook, index) => {
                    console.log(`📡 Webhook ${index + 1}:`);
                    console.log(`   ID: ${webhook.id}`);
                    console.log(`   Nome: ${webhook.name}`);
                    console.log(`   URL: ${webhook.url}`);
                    console.log(`   Email: ${webhook.email || 'N/A'}`);
                    console.log(`   Tipo de Envio: ${webhook.sendType || 'N/A'}`);
                    console.log(`   Habilitado: ${webhook.enabled ? 'Sim' : 'Não'}`);
                    console.log(`   Versão API: ${webhook.apiVersion || 'N/A'}`);
                    console.log(`   Eventos: ${webhook.events?.join(', ') || 'N/A'}`);
                    console.log('');
                });
            } catch (webhookError: any) {
                console.log('⚠️  Não foi possível verificar webhooks:');
                if (webhookError.response) {
                    console.log(`   Status: ${webhookError.response.status}`);
                    console.log(`   Mensagem: ${webhookError.response.data?.errors?.[0]?.description || webhookError.response.data?.message || 'Erro desconhecido'}`);
                } else {
                    console.log(`   Erro: ${webhookError.message}`);
                }
                console.log('');
            }
        }

        // Verificar detalhes da conta
        console.log('🔍 Buscando detalhes completos da conta...');
        let accountDetails: AsaasSubAccountResponse | null = null;
        try {
            const detailsResponse = await axios.get<AsaasSubAccountResponse>(
                `${ASAAS_BASE_URL}/accounts/${account.id}`,
                {
                    headers: {
                        'access_token': ASAAS_API_KEY,
                        'Content-Type': 'application/json'
                    }
                }
            );

            accountDetails = detailsResponse.data;
            console.log('✅ Detalhes da conta obtidos\n');
            
            if (accountDetails.apiKey && !account.apiKey) {
                console.log('🔑 API Token encontrado nos detalhes:');
                console.log(`   API Key: ${accountDetails.apiKey}\n`);
            }

            console.log('📋 Status da Conta:');
            console.log(`   Status: ${accountDetails.status || 'N/A'}`);
            if (accountDetails.status === 'APPROVED') {
                console.log('   ✅ Conta aprovada e pronta para uso!');
            } else if (accountDetails.status === 'PENDING') {
                console.log('   ⏳ Conta aguardando aprovação');
            } else if (accountDetails.status === 'REJECTED') {
                console.log('   ❌ Conta rejeitada');
            }
            console.log('');

        } catch (detailsError: any) {
            console.log('⚠️  Não foi possível obter detalhes da conta:');
            if (detailsError.response) {
                console.log(`   Status: ${detailsError.response.status}`);
                console.log(`   Mensagem: ${detailsError.response.data?.errors?.[0]?.description || detailsError.response.data?.message || 'Erro desconhecido'}`);
            } else {
                console.log(`   Erro: ${detailsError.message}`);
            }
            console.log('');
        }

        // Tentar salvar informações no banco de dados se externalReference for um UUID válido
        const finalApiKey = accountDetails?.apiKey || account.apiKey;
        if (baseAccountData.externalReference && isValidUUID(baseAccountData.externalReference)) {
            console.log('💾 Tentando salvar informações no banco de dados...');
            try {
                if (!AppDataSource.isInitialized) {
                    await AppDataSource.initialize();
                }

                const schoolsRepo = new SchoolRepositoryAdapter();
                const school = await schoolsRepo.findById(baseAccountData.externalReference);

                if (school) {
                    let updatedSchool = school;
                    
                    // Atualizar accountId se ainda não estiver salvo
                    if (account.id && !school.accountId) {
                        updatedSchool = updatedSchool.withAccountId(account.id);
                        console.log(`   ✅ accountId salvo: ${account.id}`);
                    }
                    
                    // Atualizar accountApiKey se ainda não estiver salvo e tiver sido retornado
                    if (finalApiKey && finalApiKey.trim() && !school.accountApiKey) {
                        updatedSchool = updatedSchool.withAccountApiKey(finalApiKey.trim());
                        console.log(`   ✅ accountApiKey salvo`);
                    }
                    
                    // Atualizar walletId se ainda não estiver salvo e tiver sido retornado
                    const finalWalletId = accountDetails?.walletId || account.walletId;
                    if (finalWalletId && finalWalletId.trim() && !school.walletId) {
                        updatedSchool = updatedSchool.withWalletId(finalWalletId.trim());
                        console.log(`   ✅ walletId salvo: ${finalWalletId}`);
                    }
                    
                    if (updatedSchool !== school) {
                        await schoolsRepo.save(updatedSchool);
                        console.log('   ✅ Informações salvas com sucesso no banco de dados!\n');
                    } else {
                        console.log('   ℹ️  Informações já estavam salvas no banco de dados.\n');
                    }
                } else {
                    console.log(`   ⚠️  Escola com ID ${baseAccountData.externalReference} não encontrada no banco de dados.\n`);
                }
            } catch (dbError: any) {
                console.log('   ⚠️  Erro ao salvar no banco de dados:');
                console.log(`      ${dbError.message}\n`);
            }
        } else {
            console.log('💾 Informações não serão salvas no banco de dados.');
            console.log('   Para salvar automaticamente, defina ACCOUNT_EXTERNAL_REF com um UUID válido de uma escola.\n');
        }

        console.log('✅ Teste concluído com sucesso!');
        console.log('\n📝 Próximos passos:');
        console.log('   1. Verifique no painel da Asaas se a conta foi criada');
        console.log('   2. Aguarde o webhook de criação de conta (ACCOUNT_CREATED)');
        console.log('   3. Aguarde o webhook de aprovação (ACCOUNT_STATUS_GENERAL_APPROVAL_APPROVED)');
        console.log('   4. Use o API Key retornado para criar cobranças nesta conta');
        console.log('   5. Teste criar uma cobrança PIX e verifique se o webhook de pagamento chega');

        // Mostrar como testar webhook manualmente
        if (WEBHOOK_BASE_URL) {
            console.log('\n🧪 Para testar o webhook manualmente:');
            console.log(`   curl -X POST ${WEBHOOK_BASE_URL}/accounts \\`);
            console.log('     -H "Content-Type: application/json" \\');
            console.log('     -d \'{"event": "ACCOUNT_CREATED", "account": {"id": "' + account.id + '", "status": "PENDING"}}\'');
        }

    } catch (error: any) {
        console.error('❌ Erro ao criar conta na Asaas:');
        if (error.response) {
            console.error(`   Status: ${error.response.status}`);
            console.error(`   Mensagem: ${JSON.stringify(error.response.data, null, 2)}`);
        } else {
            console.error(`   Erro: ${error.message}`);
        }
        process.exit(1);
    } finally {
        // Fechar conexão com o banco se foi inicializada
        if (AppDataSource.isInitialized) {
            await AppDataSource.destroy();
        }
    }
}

createAsaasAccount();

