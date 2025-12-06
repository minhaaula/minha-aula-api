import axios from 'axios';
import 'dotenv/config';

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000';
const PASSWORD = 'S3nh4*secreta';

// CPFs da seed
const SCHOOL_CPF = '65898370234'; // Carlos Mendes - Escola Excelência
const STUDENT_CPF = '74767131090'; // Pedro Oliveira (existe na seed)
const TEST_CPF = '39588620805'; // CPF mencionado pelo usuário

async function test() {
    console.log('🧪 Testando rota /schools/students/directory/:cpf (módulo de escolas)\n');
    console.log(`📡 API Base URL: ${API_BASE_URL}\n`);

    try {
        // 1. Login como escola via /schools/login (EMAIL)
        console.log('1. Fazendo login como escola...');
        const schoolEmail = 'carlos.mendes@escolaexcelencia.com.br'; // Email do dono da escola
        console.log(`   Email: ${schoolEmail}`);
        const loginResponse = await axios.post(`${API_BASE_URL}/schools/login`, {
            email: schoolEmail,
            password: PASSWORD
        });
        const token = loginResponse.data.accessToken;
        console.log('✅ Login realizado com sucesso');
        console.log(`   School ID: ${loginResponse.data.schoolId}`);
        console.log(`   Owner: ${loginResponse.data.ownerName}\n`);

        // 2. Testar com CPF que existe na seed
        console.log(`2. Buscando estudante com CPF: ${STUDENT_CPF} (existe na seed)`);
        try {
            const response = await axios.get(`${API_BASE_URL}/schools/students/directory/${STUDENT_CPF}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            console.log('✅ Estudante encontrado:');
            console.log(JSON.stringify(response.data, null, 2));
        } catch (error: any) {
            if (error.response) {
                console.log(`❌ Erro ${error.response.status}:`);
                console.log(JSON.stringify(error.response.data, null, 2));
            } else {
                console.log(`❌ Erro: ${error.message}`);
            }
        }

        console.log('\n');

        // 3. Testar com CPF mencionado pelo usuário
        console.log(`3. Buscando estudante com CPF: ${TEST_CPF} (mencionado pelo usuário)`);
        try {
            const response = await axios.get(`${API_BASE_URL}/schools/students/directory/${TEST_CPF}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            console.log('✅ Estudante encontrado:');
            console.log(JSON.stringify(response.data, null, 2));
        } catch (error: any) {
            if (error.response) {
                console.log(`📋 Resposta ${error.response.status}:`);
                console.log(JSON.stringify(error.response.data, null, 2));
                if (error.response.status === 404) {
                    console.log('\n📝 Nota: O 404 é esperado quando o CPF não existe no banco.');
                }
            } else {
                console.log(`❌ Erro: ${error.message}`);
            }
        }

        console.log('\n');

        // 4. Testar com CPF inválido (menos de 11 dígitos)
        console.log('4. Testando com CPF inválido (123456789)');
        try {
            const response = await axios.get(`${API_BASE_URL}/schools/students/directory/123456789`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            console.log('✅ Resposta:');
            console.log(JSON.stringify(response.data, null, 2));
        } catch (error: any) {
            if (error.response) {
                console.log(`📋 Resposta esperada ${error.response.status}:`);
                console.log(JSON.stringify(error.response.data, null, 2));
            } else {
                console.log(`❌ Erro: ${error.message}`);
            }
        }

        console.log('\n');
        console.log('📋 CPFs disponíveis na seed para teste:');
        console.log('  - 74767131090 (Pedro Oliveira)');
        console.log('  - 14329910004 (Julia Ferreira)');
        console.log('  - 65585863398 (Lucas Souza)');
        console.log('  - 38623008626 (Mariana Lima)');
        console.log('\n💡 Use um desses CPFs para testar a rota com sucesso.');

    } catch (error: any) {
        console.error('❌ Erro ao executar teste:', error.message);
        if (error.response) {
            console.error('Status:', error.response.status);
            console.error('Response:', JSON.stringify(error.response.data, null, 2));
        }
        process.exit(1);
    }
}

test().catch(console.error);

