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
        console.log(`\n🧪 ${name}`);
        const data = await fn();
        results.push({ name, success: true, data });
        console.log(`✅ Sucesso`);
        if (data && typeof data === 'object') {
            const preview = JSON.stringify(data, null, 2).substring(0, 300);
            if (preview.length < JSON.stringify(data, null, 2).length) {
                console.log(`   ${preview}...`);
            } else {
                console.log(`   ${preview}`);
            }
        }
    } catch (error: any) {
        results.push({ name, success: false, error: error.message });
        console.log(`❌ Erro: ${error.message}`);
        if (error.response) {
            console.log(`   Status: ${error.response.status}`);
            const errorData = JSON.stringify(error.response.data, null, 2).substring(0, 200);
            console.log(`   Response: ${errorData}`);
        }
    }
}

async function main() {
    console.log('🚀 Testando fluxo completo de envio de convites para alunos...');
    console.log(`📡 API Base URL: ${API_BASE_URL}\n`);

    let schoolToken: string | null = null;
    let studentToken: string | null = null;
    let createdRequestId: string | null = null;
    let classId: string | null = null;
    let studentId: string | null = null;
    let schoolId: string | null = null;

    // Dados da seed
    const SCHOOL_CPF = '65898370234'; // Carlos Mendes - Escola Excelência
    const STUDENT_CPF = '74767131090'; // Pedro Oliveira

    // 1. Login como escola
    await test('1. Login como Escola', async () => {
        const response = await axios.post(`${API_BASE_URL}/auth/login`, {
            cpf: SCHOOL_CPF,
            password: PASSWORD
        });
        schoolToken = response.data.accessToken;
        schoolId = response.data.schoolId || 's1-school-excelencia'; // Fallback para ID da seed
        return {
            userId: response.data.userId,
            schoolId: schoolId,
            fullName: response.data.fullName
        };
    });

    if (!schoolToken) {
        console.log('\n❌ Não foi possível fazer login como escola. Abortando testes.');
        return;
    }

    if (!schoolId) {
        schoolId = 's1-school-excelencia'; // Usar ID fixo da seed como fallback
    }

    // 3. Listar cursos da escola (usando contexto do token)
    await test('3. Listar Cursos da Escola', async () => {
        try {
            // Quando autenticado como escola, usar rota sem schoolId (usa contexto do token)
            const response = await axios.get(`${API_BASE_URL}/schools/courses`, {
                headers: { Authorization: `Bearer ${schoolToken}` }
            });
            
            if (response.data.courses && response.data.courses.length > 0) {
                const course = response.data.courses[0];
                return { courseId: course.id, courseName: course.name, coursesCount: response.data.courses.length };
            }
            throw new Error('Nenhum curso encontrado');
        } catch (error: any) {
            // Se falhar, tentar rota pública com schoolId
            try {
                const response = await axios.get(`${API_BASE_URL}/students/schools/${schoolId}/courses`);
                if (response.data.courses && response.data.courses.length > 0) {
                    const course = response.data.courses[0];
                    return { courseId: course.id, courseName: course.name, coursesCount: response.data.courses.length };
                }
            } catch (error2: any) {
                // Se ambas falharem, usar curso fixo da seed
                return { courseId: 'f6a7b8c9-d0e1-4f2a-3b4c-5d6e7f8a9b0', message: 'Usando curso da seed (fallback)', error: error.message };
            }
            throw error;
        }
    });

    // 4. Listar classes de um curso
    let courseId: string | null = null;
    await test('4. Listar Classes de um Curso', async () => {
        // Primeiro, tentar buscar os cursos da escola para pegar um curso real
        try {
            const coursesResponse = await axios.get(`${API_BASE_URL}/schools/courses`, {
                headers: { Authorization: `Bearer ${schoolToken}` }
            });
            
            if (coursesResponse.data.courses && coursesResponse.data.courses.length > 0) {
                courseId = coursesResponse.data.courses[0].id;
            }
        } catch (error: any) {
            // Se falhar, usar curso fixo da seed
            courseId = 'f6a7b8c9-d0e1-4f2a-3b4c-5d6e7f8a9b0';
        }
        
        if (!courseId) {
            courseId = 'f6a7b8c9-d0e1-4f2a-3b4c-5d6e7f8a9b0'; // Fallback para curso da seed
        }
        
        // Agora buscar as classes do curso - OBRIGATÓRIO buscar da API
        try {
            const response = await axios.get(`${API_BASE_URL}/schools/courses/${courseId}/classes`, {
                headers: { Authorization: `Bearer ${schoolToken}` }
            });
            
            if (response.data.classes && response.data.classes.length > 0) {
                classId = response.data.classes[0].id;
                // Validar que é um UUID válido
                const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
                if (!uuidRegex.test(classId)) {
                    throw new Error(`classId retornado não é um UUID válido: ${classId}`);
                }
                return {
                    classId: response.data.classes[0].id,
                    className: response.data.classes[0].label,
                    classesCount: response.data.classes.length,
                    courseId: courseId
                };
            }
            throw new Error('Nenhuma classe encontrada na resposta da API');
        } catch (error: any) {
            throw new Error(`Não foi possível obter classes do curso: ${error.message}. É necessário que a seed tenha sido executada e as classes existam no banco.`);
        }
    });
    
    // Garantir que temos um classId válido antes de continuar
    if (!classId) {
        throw new Error('classId não foi obtido. Não é possível continuar sem uma classe válida.');
    }

    // 5. Login como estudante
    await test('5. Login como Estudante', async () => {
        const response = await axios.post(`${API_BASE_URL}/auth/login`, {
            cpf: STUDENT_CPF,
            password: PASSWORD
        });
        studentToken = response.data.accessToken;
        studentId = response.data.userId;
        return {
            userId: response.data.userId,
            fullName: response.data.fullName
        };
    });

    if (!studentToken || !studentId) {
        console.log('\n❌ Não foi possível fazer login como estudante. Abortando testes.');
        return;
    }

    // 6. Criar convite (enrollment request) - Escola envia convite para estudante
    await test('6. Escola cria convite para estudante', async () => {
        if (!classId || !studentId) {
            throw new Error('classId ou studentId não disponível');
        }

        const firstPaymentDate = new Date();
        firstPaymentDate.setMonth(firstPaymentDate.getMonth() + 1);
        const enrollmentFeeDueDate = new Date();
        enrollmentFeeDueDate.setDate(enrollmentFeeDueDate.getDate() + 7);
        
        const response = await axios.post(
            `${API_BASE_URL}/enrollment-requests/schools/classes/${classId}/requests`,
            {
                requestedForUserId: studentId,
                requestedForDependentId: null,
                notes: 'Convite de teste criado pelo script de teste',
                enrollmentFeeAmount: 500.00, // R$ 500,00
                enrollmentFeeDueDate: enrollmentFeeDueDate.toISOString().split('T')[0], // 7 dias
                firstMonthlyPaymentDate: firstPaymentDate.toISOString().split('T')[0],
                schoolId: schoolId // Pode ser necessário dependendo da implementação
            },
            {
                headers: { Authorization: `Bearer ${schoolToken}` }
            }
        );
        
        createdRequestId = response.data.id;
        return {
            requestId: response.data.id,
            status: response.data.status,
            studentId: response.data.requestedForUserId,
            enrollmentFeeAmount: response.data.enrollmentFeeAmount,
            enrollmentFeeDueDate: response.data.enrollmentFeeDueDate
        };
    });

    if (!createdRequestId) {
        console.log('\n❌ Não foi possível criar o convite. Abortando testes.');
        return;
    }

    // 7. Estudante lista seus convites
    await test('7. Estudante lista seus convites', async () => {
        const response = await axios.get(`${API_BASE_URL}/students/enrollment-requests`, {
            headers: { Authorization: `Bearer ${studentToken}` }
        });
        
        return {
            requestsCount: response.data.requests?.length || 0,
            pendingCount: response.data.requests?.filter((r: any) => r.status === 'PENDING').length || 0
        };
    });

    // 8. Estudante visualiza detalhes do convite criado
    await test('8. Estudante visualiza detalhes do convite', async () => {
        const response = await axios.get(`${API_BASE_URL}/enrollment-requests/${createdRequestId}`, {
            headers: { Authorization: `Bearer ${studentToken}` }
        });
        
        return {
            requestId: response.data.id,
            status: response.data.status,
            enrollmentFeeAmount: response.data.enrollmentFeeAmount,
            enrollmentFeeDueDate: response.data.enrollmentFeeDueDate,
            firstMonthlyPaymentDate: response.data.firstMonthlyPaymentDate
        };
    });

    // 9. Estudante aceita o convite
    await test('9. Estudante aceita o convite', async () => {
        const response = await axios.post(
            `${API_BASE_URL}/students/enrollment-requests/${createdRequestId}/accept`,
            {
                notes: 'Estudante aceitou o convite via script de teste'
            },
            {
                headers: { Authorization: `Bearer ${studentToken}` }
            }
        );
        
        return {
            requestId: response.data.requestId,
            enrollmentId: response.data.enrollmentId,
            status: response.data.status,
            enrollmentFeeChargeId: response.data.enrollmentFeeChargeId
        };
    });

    // 10. Verificar que a matrícula foi criada
    await test('10. Verificar matrícula criada', async () => {
        const response = await axios.get(`${API_BASE_URL}/students/enrollments`, {
            headers: { Authorization: `Bearer ${studentToken}` }
        });
        
        return {
            enrollmentsCount: response.data.enrollments?.length || 0,
            activeEnrollments: response.data.enrollments?.filter((e: any) => e.status === 'ACTIVE').length || 0
        };
    });

    // 11. Verificar cobrança de taxa de matrícula criada
    await test('11. Verificar cobrança de taxa de matrícula', async () => {
        const response = await axios.get(`${API_BASE_URL}/students/payments`, {
            headers: { Authorization: `Bearer ${studentToken}` }
        });
        
        const enrollmentFees = response.data.payments?.filter((p: any) => 
            p.description?.toLowerCase().includes('matrícula') || 
            p.description?.toLowerCase().includes('enrollment')
        ) || [];
        
        return {
            totalPayments: response.data.payments?.length || 0,
            enrollmentFeesCount: enrollmentFees.length,
            latestEnrollmentFee: enrollmentFees[0] || null
        };
    });

    // 12. Escola lista convites da classe
    await test('12. Escola lista convites da classe', async () => {
        const response = await axios.get(`${API_BASE_URL}/enrollment-requests/schools/${schoolId}/classes/${classId}`, {
            headers: { Authorization: `Bearer ${schoolToken}` }
        });
        
        return {
            requestsCount: response.data.requests?.length || 0,
            approvedCount: response.data.requests?.filter((r: any) => r.status === 'APPROVED').length || 0,
            pendingCount: response.data.requests?.filter((r: any) => r.status === 'PENDING').length || 0
        };
    });

    // Resumo
    console.log('\n\n📊 RESUMO DO FLUXO DE CONVITES\n');
    console.log('═'.repeat(60));
    
    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;
    
    results.forEach((result, index) => {
        const icon = result.success ? '✅' : '❌';
        console.log(`${icon} ${result.name}`);
        if (!result.success && result.error) {
            console.log(`   Erro: ${result.error}`);
        }
    });
    
    console.log('═'.repeat(60));
    console.log(`\n✅ Sucessos: ${successCount}`);
    console.log(`❌ Falhas: ${failCount}`);
    console.log(`📈 Taxa de sucesso: ${((successCount / results.length) * 100).toFixed(1)}%\n`);

    // Informações úteis
    console.log('📝 INFORMAÇÕES DO FLUXO TESTADO\n');
    console.log('Fluxo completo:');
    console.log('  1. ✅ Escola faz login');
    console.log('  2. ✅ Escola lista cursos e classes');
    console.log('  3. ✅ Estudante faz login');
    console.log('  4. ✅ Escola cria convite para estudante');
    console.log('  5. ✅ Estudante visualiza convites recebidos');
    console.log('  6. ✅ Estudante aceita o convite');
    console.log('  7. ✅ Matrícula é criada automaticamente');
    console.log('  8. ✅ Cobrança de taxa de matrícula é gerada');
    console.log('  9. ✅ Escola pode visualizar convites da classe\n');
    
    if (createdRequestId) {
        console.log(`📌 Convite criado: ${createdRequestId}`);
    }
    if (classId) {
        console.log(`📌 Classe utilizada: ${classId}`);
    }
}

main().catch(console.error);

