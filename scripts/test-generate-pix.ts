/**
 * Script de teste para gerar PIX na Asaas
 * 
 * Este script testa a geração de PIX para uma mensalidade e verifica:
 * 1. Se a cobrança foi criada na Asaas
 * 2. Se o QR Code foi retornado
 * 
 * Uso:
 *   npm run test:pix
 *   ou
 *   npx tsx scripts/test-generate-pix.ts
 * 
 * Variáveis de ambiente necessárias:
 *   - ASAAS_API_KEY: Chave de API da Asaas (ou da subconta da escola)
 *   - BASE_URL: URL base da API (padrão: http://localhost:3000)
 *   - STUDENT_TOKEN: Token JWT de um estudante autenticado
 */

import axios from 'axios';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const STUDENT_TOKEN = process.env.STUDENT_TOKEN || 'eyJzdWIiOiIyN2M4ODA1NC05YWZjLTQxYWQtYWMxNC1hY2RkMzgzYmM3ODQiLCJjcGYiOiIzOTU4ODYyMDgwNSIsImZ1bGxOYW1lIjoiVGhpYWdvIENhbWFyZ28iLCJlbWFpbCI6InRoaWFnby5jYW1hcmdvQG91dGxvb2suY29tIiwicGVyc29uYSI6IlNUVURFTlQiLCJleHAiOjE3NjU3NTMxNzR9.htPXagEZehByqBrFbteYq4tF0xf9hh6Am9slX_ZrkXA';

interface GeneratePixResponse {
    chargeId: string;
    paymentProviderRef: string;
    pixQrCode?: string | null;
    pixCopiaECola?: string | null;
    invoiceUrl?: string | null;
    dueDate: string;
    status: string;
    amountCents: number;
    courseName: string;
}

async function testGeneratePix() {
    console.log('🧪 Teste de Geração de PIX para Mensalidade\n');
    console.log(`URL Base: ${BASE_URL}`);
    console.log(`Token: ${STUDENT_TOKEN ? '✅ Fornecido' : '❌ Não fornecido'}\n`);

    if (!STUDENT_TOKEN) {
        console.error('❌ Erro: STUDENT_TOKEN não fornecido');
        console.log('\nPara obter o token:');
        console.log('1. Faça login como estudante: POST /auth/login');
        console.log('2. Copie o access_token da resposta');
        console.log('3. Defina: export STUDENT_TOKEN="seu-token-aqui"');
        process.exit(1);
    }

    // Primeiro, vamos listar as mensalidades do estudante
    console.log('📋 Listando mensalidades do estudante...');
    try {
        const paymentsResponse = await axios.get(`${BASE_URL}/students/payments`, {
            headers: {
                'Authorization': `Bearer ${STUDENT_TOKEN}`
            }
        });

        const payments = paymentsResponse.data.payments || [];
        console.log(`✅ Encontradas ${payments.length} mensalidade(s)\n`);

        if (payments.length === 0) {
            console.log('⚠️  Nenhuma mensalidade encontrada. Criando uma mensalidade de teste...');
            console.log('   (Você precisa criar uma mensalidade manualmente ou usar uma existente)');
            process.exit(1);
        }

        // Filtrar apenas mensalidades pendentes
        const pendingPayments = payments.filter((p: any) => 
            p.status === 'pendente' || p.status === 'atrasado'
        );

        if (pendingPayments.length === 0) {
            console.log('⚠️  Nenhuma mensalidade pendente encontrada.');
            console.log('   Todas as mensalidades já foram pagas ou não há mensalidades em aberto.\n');
            process.exit(1);
        }

        console.log('📝 Mensalidades pendentes encontradas:');
        pendingPayments.forEach((payment: any, index: number) => {
            console.log(`   ${index + 1}. ${payment.courseName} - R$ ${(payment.amountCents / 100).toFixed(2)} - Vencimento: ${payment.dueDate} - Status: ${payment.status} - ID: ${payment.chargeId || 'N/A'}`);
        });
        console.log('');

        // Usar o chargeId da primeira mensalidade pendente ou da variável de ambiente
        const CHARGE_ID = process.env.CHARGE_ID || (pendingPayments[0]?.chargeId);
        
        if (!CHARGE_ID) {
            console.error('❌ Erro: Não foi possível obter o chargeId');
            console.log('   A rota de listagem não retornou o chargeId.');
            console.log('   Defina manualmente: export CHARGE_ID="uuid-da-mensalidade"');
            process.exit(1);
        }

        console.log(`🔐 Gerando PIX para mensalidade: ${CHARGE_ID}\n`);

        // Gerar PIX
        const pixResponse = await axios.post<GeneratePixResponse>(
            `${BASE_URL}/students/charges/${CHARGE_ID}/payments/pix`,
            {},
            {
                headers: {
                    'Authorization': `Bearer ${STUDENT_TOKEN}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        const pixData = pixResponse.data;

        console.log('✅ PIX gerado com sucesso!\n');
        console.log('📊 Dados do PIX:');
        console.log(`   Charge ID: ${pixData.chargeId}`);
        console.log(`   Payment Provider Ref: ${pixData.paymentProviderRef}`);
        console.log(`   Status: ${pixData.status}`);
        console.log(`   Valor: R$ ${(pixData.amountCents / 100).toFixed(2)}`);
        console.log(`   Vencimento: ${pixData.dueDate}`);
        console.log(`   Curso: ${pixData.courseName}`);
        console.log(`   URL da Fatura: ${pixData.invoiceUrl || 'N/A'}`);
        console.log('');

        if (pixData.pixQrCode) {
            console.log('✅ QR Code recebido!');
            console.log(`   Tipo: ${pixData.pixQrCode.startsWith('data:image') ? 'Base64 Image' : 'String'}`);
            console.log(`   Tamanho: ${pixData.pixQrCode.length} caracteres`);
            console.log('');
        } else {
            console.log('⚠️  QR Code não recebido na resposta');
            console.log('');
        }

        if (pixData.pixCopiaECola) {
            console.log('✅ Código PIX Copia e Cola recebido!');
            console.log(`   Código: ${pixData.pixCopiaECola.substring(0, 50)}...`);
            console.log(`   Tamanho: ${pixData.pixCopiaECola.length} caracteres`);
            console.log('');
        } else {
            console.log('⚠️  Código PIX Copia e Cola não recebido na resposta');
            console.log('');
        }

        // Verificar na Asaas se a cobrança foi criada
        const ASAAS_API_KEY = process.env.ASAAS_API_KEY;
        if (ASAAS_API_KEY && pixData.paymentProviderRef) {
            console.log('🔍 Verificando cobrança na Asaas...');
            try {
                const asaasResponse = await axios.get(
                    `https://www.asaas.com/api/v3/payments/${pixData.paymentProviderRef}`,
                    {
                        headers: {
                            'access_token': ASAAS_API_KEY,
                            'Content-Type': 'application/json'
                        }
                    }
                );

                const asaasPayment = asaasResponse.data;
                console.log('✅ Cobrança encontrada na Asaas!');
                console.log(`   ID: ${asaasPayment.id}`);
                console.log(`   Status: ${asaasPayment.status}`);
                console.log(`   Valor: R$ ${asaasPayment.value}`);
                console.log(`   Tipo: ${asaasPayment.billingType}`);
                console.log(`   Vencimento: ${asaasPayment.dueDate}`);
                console.log('');

                if (asaasPayment.billingType === 'PIX') {
                    console.log('✅ Tipo de cobrança confirmado: PIX');
                } else {
                    console.log(`⚠️  Tipo de cobrança: ${asaasPayment.billingType} (esperado: PIX)`);
                }
            } catch (error: any) {
                console.log('⚠️  Não foi possível verificar na Asaas:');
                if (error.response) {
                    console.log(`   Status: ${error.response.status}`);
                    console.log(`   Mensagem: ${error.response.data?.errors?.[0]?.description || error.response.data?.message || 'Erro desconhecido'}`);
                } else {
                    console.log(`   Erro: ${error.message}`);
                }
                console.log('');
            }
        } else {
            console.log('⚠️  ASAAS_API_KEY não fornecida, pulando verificação na Asaas');
            console.log('');
        }

        console.log('✅ Teste concluído com sucesso!');
        console.log('\n📝 Próximos passos:');
        console.log('   1. Verifique no painel da Asaas se a cobrança foi criada');
        console.log('   2. Teste o pagamento usando o QR Code ou código copia e cola');
        console.log('   3. Verifique se o webhook atualiza o status da mensalidade');

    } catch (error: any) {
        console.error('❌ Erro ao testar geração de PIX:');
        if (error.response) {
            console.error(`   Status: ${error.response.status}`);
            console.error(`   Mensagem: ${JSON.stringify(error.response.data, null, 2)}`);
        } else {
            console.error(`   Erro: ${error.message}`);
        }
        process.exit(1);
    }
}

testGeneratePix();

