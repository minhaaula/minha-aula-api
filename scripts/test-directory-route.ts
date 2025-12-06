import axios from 'axios';
import 'dotenv/config';

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000';
const PASSWORD = 'S3nh4*secreta';

// CPFs da seed
const SCHOOL_CPF = '65898370234'; // Carlos Mendes - Escola Excelência
const STUDENT_CPF = '74767131090'; // Pedro Oliveira (existe na seed)

async function test() {
    console.log('🧪 Testando rota /students/directory/:cpf\n');
    console.log(`📡 API Base URL: ${API_BASE_URL}\n`);

    try {
        // 1. Login como escola
        console.log('1. Fazendo login como escola...');
        const loginResponse = await axios.post(`${API_BASE_URL}/auth/login`, {
            cpf: SCHOOL_CPF,
            password: PASSWORD
        });
        const token = loginResponse.data.accessToken;
        console.log('✅ Login realizado com sucesso\n');

        // 2. Testar com CPF que existe na seed
        console.log(`2. Buscando estudante com CPF: ${STUDENT_CPF}`);
        try {
            const response = await axios.get(`${API_BASE_URL}/students/directory/${STUDENT_CPF}`, {
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

        // 3. Testar com CPF que NÃO existe na seed
        const nonExistentCpf = '39588620805';
        console.log(`3. Buscando estudante com CPF: ${nonExistentCpf} (não existe na seed)`);
        try {
            const response = await axios.get(`${API_BASE_URL}/students/directory/${nonExistentCpf}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            console.log('✅ Estudante encontrado:');
            console.log(JSON.stringify(response.data, null, 2));
        } catch (error: any) {
            if (error.response) {
                console.log(`✅ Resposta esperada ${error.response.status}:`);
                console.log(JSON.stringify(error.response.data, null, 2));
                if (error.response.status === 404) {
                    console.log('\n📝 Nota: O 404 é esperado quando o CPF não existe no banco.');
                }
            } else {
                console.log(`❌ Erro: ${error.message}`);
            }
        }

        console.log('\n');
        console.log('📋 CPFs disponíveis na seed:');
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
    }
}

test().catch(console.error);

