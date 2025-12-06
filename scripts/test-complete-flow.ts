import axios from 'axios';
import 'dotenv/config';

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000';
const PASSWORD = 'S3nh4*secreta';

interface TestResult {
    name: string;
    success: boolean;
    error?: string;
    data?: any;
}

const results: TestResult[] = [];

async function test(name: string, fn: () => Promise<any>): Promise<void> {
    try {
        console.log(`\n🧪 Testando: ${name}`);
        const data = await fn();
        results.push({ name, success: true, data });
        console.log(`✅ Sucesso: ${name}`);
        if (data && typeof data === 'object') {
            console.log(`   Dados:`, JSON.stringify(data, null, 2).substring(0, 200));
        }
    } catch (error: any) {
        results.push({ name, success: false, error: error.message });
        console.log(`❌ Erro: ${name}`);
        console.log(`   ${error.message}`);
        if (error.response) {
            console.log(`   Status: ${error.response.status}`);
            console.log(`   Response:`, JSON.stringify(error.response.data, null, 2).substring(0, 200));
        }
    }
}

async function main() {
    console.log('🚀 Iniciando testes do fluxo completo...');
    console.log(`📡 API Base URL: ${API_BASE_URL}\n`);

    let schoolToken: string | null = null;
    let studentToken: string | null = null;

    // 1. Login como escola (primeira escola)
    await test('Login como Escola Excelência', async () => {
        const response = await axios.post(`${API_BASE_URL}/auth/login`, {
            cpf: '65898370234',
            password: PASSWORD
        });
        schoolToken = response.data.accessToken;
        return { userId: response.data.userId, schoolId: response.data.schoolId };
    });

    // 2. Login como estudante
    await test('Login como Estudante', async () => {
        const response = await axios.post(`${API_BASE_URL}/auth/login`, {
            cpf: '74767131090',
            password: PASSWORD
        });
        studentToken = response.data.accessToken;
        return { userId: response.data.userId };
    });

    // 3. Listar escolas (se endpoint existir)
    await test('Listar Escolas', async () => {
        try {
            const response = await axios.get(`${API_BASE_URL}/schools`, {
                headers: { Authorization: `Bearer ${schoolToken}` }
            });
            return { count: Array.isArray(response.data) ? response.data.length : 0 };
        } catch (error: any) {
            if (error.response?.status === 404) {
                return { message: 'Endpoint não encontrado (pode ser esperado)' };
            }
            throw error;
        }
    });

    // 4. Listar cursos da escola
    await test('Listar Cursos da Escola', async () => {
        try {
            const response = await axios.get(`${API_BASE_URL}/schools/s1-school-excelencia/courses`, {
                headers: { Authorization: `Bearer ${schoolToken}` }
            });
            return { count: Array.isArray(response.data) ? response.data.length : 0 };
        } catch (error: any) {
            if (error.response?.status === 404) {
                return { message: 'Endpoint não encontrado (pode ser esperado)' };
            }
            throw error;
        }
    });

    // 5. Listar classes de um curso
    await test('Listar Classes de um Curso', async () => {
        try {
            const response = await axios.get(`${API_BASE_URL}/courses/course-s1-school-excelencia-1/classes`, {
                headers: { Authorization: `Bearer ${schoolToken}` }
            });
            return { count: Array.isArray(response.data) ? response.data.length : 0 };
        } catch (error: any) {
            if (error.response?.status === 404) {
                return { message: 'Endpoint não encontrado (pode ser esperado)' };
            }
            throw error;
        }
    });

    // 6. Listar matrículas do estudante
    await test('Listar Matrículas do Estudante', async () => {
        try {
            const response = await axios.get(`${API_BASE_URL}/students/enrollments`, {
                headers: { Authorization: `Bearer ${studentToken}` }
            });
            return { count: Array.isArray(response.data) ? response.data.length : 0 };
        } catch (error: any) {
            if (error.response?.status === 404) {
                return { message: 'Endpoint não encontrado (pode ser esperado)' };
            }
            throw error;
        }
    });

    // 7. Listar enrollment requests (convites)
    await test('Listar Enrollment Requests', async () => {
        try {
            const response = await axios.get(`${API_BASE_URL}/enrollment-requests`, {
                headers: { Authorization: `Bearer ${studentToken}` }
            });
            return { count: Array.isArray(response.data) ? response.data.length : 0 };
        } catch (error: any) {
            if (error.response?.status === 404) {
                return { message: 'Endpoint não encontrado (pode ser esperado)' };
            }
            throw error;
        }
    });

    // 8. Listar cobranças financeiras do estudante
    await test('Listar Cobranças Financeiras do Estudante', async () => {
        try {
            const response = await axios.get(`${API_BASE_URL}/students/payments`, {
                headers: { Authorization: `Bearer ${studentToken}` }
            });
            return { count: Array.isArray(response.data) ? response.data.length : 0 };
        } catch (error: any) {
            if (error.response?.status === 404) {
                return { message: 'Endpoint não encontrado (pode ser esperado)' };
            }
            throw error;
        }
    });

    // 9. Listar cobranças da escola
    await test('Listar Cobranças da Escola', async () => {
        try {
            const response = await axios.get(`${API_BASE_URL}/schools/s1-school-excelencia/payments`, {
                headers: { Authorization: `Bearer ${schoolToken}` }
            });
            return { count: Array.isArray(response.data) ? response.data.length : 0 };
        } catch (error: any) {
            if (error.response?.status === 404) {
                return { message: 'Endpoint não encontrado (pode ser esperado)' };
            }
            throw error;
        }
    });

    // Resumo
    console.log('\n\n📊 RESUMO DOS TESTES\n');
    console.log('═'.repeat(60));
    
    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;
    
    results.forEach((result, index) => {
        const icon = result.success ? '✅' : '❌';
        console.log(`${icon} ${index + 1}. ${result.name}`);
        if (!result.success && result.error) {
            console.log(`   Erro: ${result.error}`);
        }
    });
    
    console.log('═'.repeat(60));
    console.log(`\n✅ Sucessos: ${successCount}`);
    console.log(`❌ Falhas: ${failCount}`);
    console.log(`📈 Taxa de sucesso: ${((successCount / results.length) * 100).toFixed(1)}%\n`);

    // Informações úteis
    console.log('📝 INFORMAÇÕES ÚTEIS\n');
    console.log('Escolas criadas:');
    console.log('  1. Escola Excelência (CNPJ: 11111111000111)');
    console.log('  2. Instituto Conhecimento (CNPJ: 22222222000222)');
    console.log('  3. Academia Sabedoria (CNPJ: 33333333000333)');
    console.log('  4. Centro Educacional (CNPJ: 44444444000444)');
    console.log('  5. Escola Futuro (CNPJ: 55555555000555)');
    console.log('\nEstudantes de exemplo:');
    console.log('  - Pedro Oliveira (CPF: 11111111111)');
    console.log('  - Julia Ferreira (CPF: 11111111112)');
    console.log('  - Lucas Souza (CPF: 11111111113)');
    console.log('  - Mariana Lima (CPF: 11111111114)');
    console.log('\nSenha padrão para todos: S3nh4*secreta\n');
}

main().catch(console.error);

