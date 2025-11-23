#!/usr/bin/env tsx
/**
 * Script para testar as rotas de dados bancários
 * 
 * Uso:
 *   tsx scripts/test-bank-accounts-routes.ts
 * 
 * Requisitos:
 *   - Servidor rodando na porta 3000 (ou ajustar BASE_URL)
 *   - Ter uma escola criada e token de autenticação válido
 */

import axios from 'axios';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const AUTH_TOKEN = process.env.AUTH_TOKEN || '';

interface TestResult {
    test: string;
    passed: boolean;
    error?: string;
    data?: any;
}

const results: TestResult[] = [];

function logResult(result: TestResult) {
    results.push(result);
    const status = result.passed ? '✅' : '❌';
    console.log(`${status} ${result.test}`);
    if (result.error) {
        console.log(`   Erro: ${result.error}`);
    }
    if (result.data && process.env.VERBOSE) {
        console.log(`   Dados:`, JSON.stringify(result.data, null, 2));
    }
}

async function testCreateBankAccount() {
    try {
        const response = await axios.post(
            `${BASE_URL}/schools/bank-accounts`,
            {
                bankName: 'Banco do Brasil',
                banco: 1,
                bankAgency: '1234',
                digitoAgencia: '5',
                bankAccount: '12345678',
                digitoConta: '9',
                bankAccountType: 'CORRENTE',
                bankAccountHolderDocument: '12345678000190',
                PIX: 'teste@escola.com'
            },
            {
                headers: {
                    'Authorization': `Bearer ${AUTH_TOKEN}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        if (response.status === 201 && response.data) {
            const data = response.data;
            const hasAllFields = 
                data.bankCode === 1 &&
                data.bankAgencyDigit === '5' &&
                data.bankAccountDigit === '9' &&
                data.pixKey === 'teste@escola.com';

            logResult({
                test: 'POST /schools/bank-accounts - Criar conta com novos campos',
                passed: hasAllFields,
                data: response.data
            });

            return response.data.id;
        } else {
            logResult({
                test: 'POST /schools/bank-accounts - Criar conta com novos campos',
                passed: false,
                error: `Status inesperado: ${response.status}`
            });
            return null;
        }
    } catch (error: any) {
        logResult({
            test: 'POST /schools/bank-accounts - Criar conta com novos campos',
            passed: false,
            error: error.response?.data?.error || error.message
        });
        return null;
    }
}

async function testUpdateBankAccount(accountId: string) {
    try {
        const response = await axios.put(
            `${BASE_URL}/schools/bank-accounts/${accountId}`,
            {
                banco: 237,
                digitoAgencia: 'X',
                digitoConta: 'Y',
                PIX: 'pix-atualizado@teste.com'
            },
            {
                headers: {
                    'Authorization': `Bearer ${AUTH_TOKEN}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        if (response.status === 200 && response.data) {
            const data = response.data;
            const hasUpdatedFields = 
                data.bankCode === 237 &&
                data.bankAgencyDigit === 'X' &&
                data.bankAccountDigit === 'Y' &&
                data.pixKey === 'pix-atualizado@teste.com';

            logResult({
                test: 'PUT /schools/bank-accounts/:id - Atualizar novos campos',
                passed: hasUpdatedFields,
                data: response.data
            });
        } else {
            logResult({
                test: 'PUT /schools/bank-accounts/:id - Atualizar novos campos',
                passed: false,
                error: `Status inesperado: ${response.status}`
            });
        }
    } catch (error: any) {
        logResult({
            test: 'PUT /schools/bank-accounts/:id - Atualizar novos campos',
            passed: false,
            error: error.response?.data?.error || error.message
        });
    }
}

async function testListBankAccounts() {
    try {
        const response = await axios.get(
            `${BASE_URL}/schools/bank-accounts`,
            {
                headers: {
                    'Authorization': `Bearer ${AUTH_TOKEN}`
                }
            }
        );

        if (response.status === 200 && Array.isArray(response.data.accounts)) {
            const accounts = response.data.accounts;
            const hasNewFields = accounts.some((acc: any) => 
                acc.bankCode !== undefined ||
                acc.bankAgencyDigit !== undefined ||
                acc.bankAccountDigit !== undefined ||
                acc.pixKey !== undefined
            );

            logResult({
                test: 'GET /schools/bank-accounts - Listar contas com novos campos',
                passed: hasNewFields || accounts.length === 0,
                data: { count: accounts.length, sample: accounts[0] }
            });
        } else {
            logResult({
                test: 'GET /schools/bank-accounts - Listar contas com novos campos',
                passed: false,
                error: `Status inesperado: ${response.status}`
            });
        }
    } catch (error: any) {
        logResult({
            test: 'GET /schools/bank-accounts - Listar contas com novos campos',
            passed: false,
            error: error.response?.data?.error || error.message
        });
    }
}

async function testCreateWithoutNewFields() {
    try {
        const response = await axios.post(
            `${BASE_URL}/schools/bank-accounts`,
            {
                bankName: 'Itaú',
                bankAgency: '5678',
                bankAccount: '87654321',
                bankAccountType: 'POUPANCA',
                bankAccountHolderDocument: '12345678000191'
            },
            {
                headers: {
                    'Authorization': `Bearer ${AUTH_TOKEN}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        if (response.status === 201) {
            logResult({
                test: 'POST /schools/bank-accounts - Criar conta sem novos campos (opcionais)',
                passed: true,
                data: response.data
            });
        } else {
            logResult({
                test: 'POST /schools/bank-accounts - Criar conta sem novos campos (opcionais)',
                passed: false,
                error: `Status inesperado: ${response.status}`
            });
        }
    } catch (error: any) {
        logResult({
            test: 'POST /schools/bank-accounts - Criar conta sem novos campos (opcionais)',
            passed: false,
            error: error.response?.data?.error || error.message
        });
    }
}

async function runTests() {
    console.log('🧪 Testando rotas de dados bancários\n');
    console.log(`Base URL: ${BASE_URL}`);
    console.log(`Token: ${AUTH_TOKEN ? 'Definido' : 'Não definido (use AUTH_TOKEN=...)'}\n`);

    if (!AUTH_TOKEN) {
        console.log('⚠️  Aviso: AUTH_TOKEN não foi definido. Alguns testes podem falhar.\n');
    }

    // Teste 1: Criar conta com novos campos
    const accountId = await testCreateBankAccount();

    // Teste 2: Atualizar conta com novos campos
    if (accountId) {
        await testUpdateBankAccount(accountId);
    }

    // Teste 3: Listar contas
    await testListBankAccounts();

    // Teste 4: Criar conta sem novos campos
    await testCreateWithoutNewFields();

    // Resumo
    console.log('\n📊 Resumo dos testes:');
    const passed = results.filter(r => r.passed).length;
    const failed = results.filter(r => !r.passed).length;
    console.log(`✅ Passou: ${passed}`);
    console.log(`❌ Falhou: ${failed}`);
    console.log(`📈 Total: ${results.length}`);

    if (failed > 0) {
        console.log('\n❌ Testes que falharam:');
        results.filter(r => !r.passed).forEach(r => {
            console.log(`   - ${r.test}: ${r.error}`);
        });
        process.exit(1);
    } else {
        console.log('\n✅ Todos os testes passaram!');
        process.exit(0);
    }
}

runTests().catch((error) => {
    console.error('Erro ao executar testes:', error);
    process.exit(1);
});

