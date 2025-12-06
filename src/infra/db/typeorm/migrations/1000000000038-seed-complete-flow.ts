import { MigrationInterface, QueryRunner } from 'typeorm';
import { randomUUID } from 'node:crypto';

// UUIDs fixos para manter a seed determinística
const UUIDs = {
    // Endereços das escolas (5)
    addresses: [
        'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5',
        'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6',
        'c3d4e5f6-a7b8-4c9d-0e1f-2a3b4c5d6e7',
        'd4e5f6a7-b8c9-4d0e-1f2a-3b4c5d6e7f8',
        'e5f6a7b8-c9d0-4e1f-2a3b-4c5d6e7f8a9'
    ],
    // Cursos (10)
    courses: [
        'f6a7b8c9-d0e1-4f2a-3b4c-5d6e7f8a9b0',
        'a7b8c9d0-e1f2-4a3b-4c5d-6e7f8a9b0c1',
        'b8c9d0e1-f2a3-4b4c-5d6e-7f8a9b0c1d2',
        'c9d0e1f2-a3b4-4c5d-6e7f-8a9b0c1d2e3',
        'd0e1f2a3-b4c5-4d6e-7f8a-9b0c1d2e3f4',
        'e1f2a3b4-c5d6-4e7f-8a9b-0c1d2e3f4a5',
        'f2a3b4c5-d6e7-4f8a-9b0c-1d2e3f4a5b6',
        'a3b4c5d6-e7f8-4a9b-0c1d-2e3f4a5b6c7',
        'b4c5d6e7-f8a9-4b0c-1d2e-3f4a5b6c7d8',
        'c5d6e7f8-a9b0-4c1d-2e3f-4a5b6c7d8e9'
    ],
    // Classes (20)
    classes: [
        'd6e7f8a9-b0c1-4d2e-3f4a-5b6c7d8e9f0',
        'e7f8a9b0-c1d2-4e3f-4a5b-6c7d8e9f0a1',
        'f8a9b0c1-d2e3-4f4a-5b6c-7d8e9f0a1b2',
        'a9b0c1d2-e3f4-4a5b-6c7d-8e9f0a1b2c3',
        'b0c1d2e3-f4a5-4b6c-7d8e-9f0a1b2c3d4',
        'c1d2e3f4-a5b6-4c7d-8e9f-0a1b2c3d4e5',
        'd2e3f4a5-b6c7-4d8e-9f0a-1b2c3d4e5f6',
        'e3f4a5b6-c7d8-4e9f-0a1b-2c3d4e5f6a7',
        'f4a5b6c7-d8e9-4f0a-1b2c-3d4e5f6a7b8',
        'a5b6c7d8-e9f0-4a1b-2c3d-4e5f6a7b8c9',
        'b6c7d8e9-f0a1-4b2c-3d4e-5f6a7b8c9d0',
        'c7d8e9f0-a1b2-4c3d-4e5f-6a7b8c9d0e1',
        'd8e9f0a1-b2c3-4d4e-5f6a-7b8c9d0e1f2',
        'e9f0a1b2-c3d4-4e5f-6a7b-8c9d0e1f2a3',
        'f0a1b2c3-d4e5-4f6a-7b8c-9d0e1f2a3b4',
        'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5',
        'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6',
        'c3d4e5f6-a7b8-4c9d-0e1f-2a3b4c5d6e7',
        'd4e5f6a7-b8c9-4d0e-1f2a-3b4c5d6e7f8',
        'e5f6a7b8-c9d0-4e1f-2a3b-4c5d6e7f8a9'
    ],
    // Enrollment Requests (4)
    enrollmentRequests: [
        'f6a7b8c9-d0e1-4f2a-3b4c-5d6e7f8a9b0',
        'a7b8c9d0-e1f2-4a3b-4c5d-6e7f8a9b0c1',
        'b8c9d0e1-f2a3-4b4c-5d6e-7f8a9b0c1d2',
        'c9d0e1f2-a3b4-4c5d-6e7f-8a9b0c1d2e3'
    ]
};

// Hash da senha: S3nh4*secreta
const PASSWORD_HASH = 'e4579c15529747072b655137ed957ebb:fb267854b07245a9c5cbe845d6fe275a5b7d683baf649720cfd79d7efe274ac71f60766dc1218e5711bfa02b5b5f619b5d92aa9a00df3ec78e67d71c052e1099';

// 5 Escolas com seus donos
const SCHOOL_OWNERS = [
    {
        id: 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d',
        fullName: 'Carlos Mendes',
        birthDate: '1975-03-15',
        email: 'carlos.mendes@escolaexcelencia.com.br',
        phone: '11987654321',
        cpf: '65898370234',
        addressStreet: 'Av. Paulista',
        addressNumber: '1000',
        addressComplement: 'Sala 501',
        addressDistrict: 'Bela Vista',
        addressCity: 'São Paulo',
        addressState: 'SP',
        addressZipCode: '01310100',
        persona: 'SCHOOL'
    },
    {
        id: 'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e',
        fullName: 'Maria Silva',
        birthDate: '1980-07-22',
        email: 'maria.silva@institutoconhecimento.com.br',
        phone: '11976543210',
        cpf: '59307219206',
        addressStreet: 'Rua Augusta',
        addressNumber: '2000',
        addressComplement: null,
        addressDistrict: 'Consolação',
        addressCity: 'São Paulo',
        addressState: 'SP',
        addressZipCode: '01413000',
        persona: 'SCHOOL'
    },
    {
        id: 'c3d4e5f6-a7b8-4c9d-0e1f-2a3b4c5d6e7f',
        fullName: 'João Santos',
        birthDate: '1978-11-08',
        email: 'joao.santos@academiasabedoria.com.br',
        phone: '11965432109',
        cpf: '70507193407',
        addressStreet: 'Rua dos Três Irmãos',
        addressNumber: '300',
        addressComplement: 'Bloco A',
        addressDistrict: 'Vila Progredior',
        addressCity: 'São Paulo',
        addressState: 'SP',
        addressZipCode: '05615000',
        persona: 'SCHOOL'
    },
    {
        id: 'd4e5f6a7-b8c9-4d0e-1f2a-3b4c5d6e7f8a',
        fullName: 'Ana Costa',
        birthDate: '1982-05-30',
        email: 'ana.costa@centroeducacional.com.br',
        phone: '11954321098',
        cpf: '78864357378',
        addressStreet: 'Av. Faria Lima',
        addressNumber: '1500',
        addressComplement: 'Conjunto 201',
        addressDistrict: 'Pinheiros',
        addressCity: 'São Paulo',
        addressState: 'SP',
        addressZipCode: '01452000',
        persona: 'SCHOOL'
    },
    {
        id: 'e5f6a7b8-c9d0-4e1f-2a3b-4c5d6e7f8a9b',
        fullName: 'Roberto Alves',
        birthDate: '1976-09-14',
        email: 'roberto.alves@escolafuturo.com.br',
        phone: '11943210987',
        cpf: '45958652109',
        addressStreet: 'Rua Haddock Lobo',
        addressNumber: '500',
        addressComplement: null,
        addressDistrict: 'Cerqueira César',
        addressCity: 'São Paulo',
        addressState: 'SP',
        addressZipCode: '01414000',
        persona: 'SCHOOL'
    }
] as const;

const SCHOOLS = [
    {
        id: 's1-school-excelencia',
        name: 'Escola Excelência',
        email: 'contato@escolaexcelencia.com.br',
        phone: '1133334444',
        cnpj: '11111111000111',
        ownerUserId: SCHOOL_OWNERS[0].id,
        accountId: 'acc-excelencia-001',
        incomeValue: 20000
    },
    {
        id: 's2-instituto-conhecimento',
        name: 'Instituto Conhecimento',
        email: 'contato@institutoconhecimento.com.br',
        phone: '1144445555',
        cnpj: '22222222000222',
        ownerUserId: SCHOOL_OWNERS[1].id,
        accountId: 'acc-conhecimento-001',
        incomeValue: 25000
    },
    {
        id: 's3-academia-sabedoria',
        name: 'Academia Sabedoria',
        email: 'contato@academiasabedoria.com.br',
        phone: '1155556666',
        cnpj: '33333333000333',
        ownerUserId: SCHOOL_OWNERS[2].id,
        accountId: 'acc-sabedoria-001',
        incomeValue: 18000
    },
    {
        id: 's4-centro-educacional',
        name: 'Centro Educacional',
        email: 'contato@centroeducacional.com.br',
        phone: '1166667777',
        cnpj: '44444444000444',
        ownerUserId: SCHOOL_OWNERS[3].id,
        accountId: 'acc-educacional-001',
        incomeValue: 22000
    },
    {
        id: 's5-escola-futuro',
        name: 'Escola Futuro',
        email: 'contato@escolafuturo.com.br',
        phone: '1177778888',
        cnpj: '55555555000555',
        ownerUserId: SCHOOL_OWNERS[4].id,
        accountId: 'acc-futuro-001',
        incomeValue: 30000
    }
] as const;

// Endereços das escolas (UUIDs v4)
const SCHOOL_ADDRESSES = [
    { id: UUIDs.addresses[0], schoolId: SCHOOLS[0].id, index: 0 },
    { id: UUIDs.addresses[1], schoolId: SCHOOLS[1].id, index: 1 },
    { id: UUIDs.addresses[2], schoolId: SCHOOLS[2].id, index: 2 },
    { id: UUIDs.addresses[3], schoolId: SCHOOLS[3].id, index: 3 },
    { id: UUIDs.addresses[4], schoolId: SCHOOLS[4].id, index: 4 }
].map(({ id, schoolId, index }) => ({
    id,
    schoolId,
    street: `Rua da Escola ${index + 1}`,
    number: `${(index + 1) * 100}`,
    complement: index % 2 === 0 ? 'Bloco Principal' : null,
    district: ['Centro', 'Vila Nova', 'Jardim', 'Parque', 'Alto'][index],
    city: 'São Paulo',
    state: 'SP',
    zipCode: `01000${String(index).padStart(3, '0')}`
}));

// Cursos (2 por escola) - UUIDs v4
const COURSES = [
    { id: UUIDs.courses[0], schoolId: SCHOOLS[0].id, schoolIndex: 0, type: 1 },
    { id: UUIDs.courses[1], schoolId: SCHOOLS[0].id, schoolIndex: 0, type: 2 },
    { id: UUIDs.courses[2], schoolId: SCHOOLS[1].id, schoolIndex: 1, type: 1 },
    { id: UUIDs.courses[3], schoolId: SCHOOLS[1].id, schoolIndex: 1, type: 2 },
    { id: UUIDs.courses[4], schoolId: SCHOOLS[2].id, schoolIndex: 2, type: 1 },
    { id: UUIDs.courses[5], schoolId: SCHOOLS[2].id, schoolIndex: 2, type: 2 },
    { id: UUIDs.courses[6], schoolId: SCHOOLS[3].id, schoolIndex: 3, type: 1 },
    { id: UUIDs.courses[7], schoolId: SCHOOLS[3].id, schoolIndex: 3, type: 2 },
    { id: UUIDs.courses[8], schoolId: SCHOOLS[4].id, schoolIndex: 4, type: 1 },
    { id: UUIDs.courses[9], schoolId: SCHOOLS[4].id, schoolIndex: 4, type: 2 }
].map(({ id, schoolId, schoolIndex, type }) => ({
    id,
    schoolId,
    name: type === 1 ? `Programação ${schoolIndex + 1}` : `Design ${schoolIndex + 1}`,
    description: type === 1 ? `Curso de programação da ${SCHOOLS[schoolIndex].name}` : `Curso de design da ${SCHOOLS[schoolIndex].name}`,
    isActive: true
}));

// Classes (2 por curso) - UUIDs v4
const COURSE_CLASSES = [
    { id: UUIDs.classes[0], courseId: COURSES[0].id, courseName: COURSES[0].name, classNum: 1 },
    { id: UUIDs.classes[1], courseId: COURSES[0].id, courseName: COURSES[0].name, classNum: 2 },
    { id: UUIDs.classes[2], courseId: COURSES[1].id, courseName: COURSES[1].name, classNum: 1 },
    { id: UUIDs.classes[3], courseId: COURSES[1].id, courseName: COURSES[1].name, classNum: 2 },
    { id: UUIDs.classes[4], courseId: COURSES[2].id, courseName: COURSES[2].name, classNum: 1 },
    { id: UUIDs.classes[5], courseId: COURSES[2].id, courseName: COURSES[2].name, classNum: 2 },
    { id: UUIDs.classes[6], courseId: COURSES[3].id, courseName: COURSES[3].name, classNum: 1 },
    { id: UUIDs.classes[7], courseId: COURSES[3].id, courseName: COURSES[3].name, classNum: 2 },
    { id: UUIDs.classes[8], courseId: COURSES[4].id, courseName: COURSES[4].name, classNum: 1 },
    { id: UUIDs.classes[9], courseId: COURSES[4].id, courseName: COURSES[4].name, classNum: 2 },
    { id: UUIDs.classes[10], courseId: COURSES[5].id, courseName: COURSES[5].name, classNum: 1 },
    { id: UUIDs.classes[11], courseId: COURSES[5].id, courseName: COURSES[5].name, classNum: 2 },
    { id: UUIDs.classes[12], courseId: COURSES[6].id, courseName: COURSES[6].name, classNum: 1 },
    { id: UUIDs.classes[13], courseId: COURSES[6].id, courseName: COURSES[6].name, classNum: 2 },
    { id: UUIDs.classes[14], courseId: COURSES[7].id, courseName: COURSES[7].name, classNum: 1 },
    { id: UUIDs.classes[15], courseId: COURSES[7].id, courseName: COURSES[7].name, classNum: 2 },
    { id: UUIDs.classes[16], courseId: COURSES[8].id, courseName: COURSES[8].name, classNum: 1 },
    { id: UUIDs.classes[17], courseId: COURSES[8].id, courseName: COURSES[8].name, classNum: 2 },
    { id: UUIDs.classes[18], courseId: COURSES[9].id, courseName: COURSES[9].name, classNum: 1 },
    { id: UUIDs.classes[19], courseId: COURSES[9].id, courseName: COURSES[9].name, classNum: 2 }
].map(({ id, courseId, courseName, classNum }) => ({
    id,
    courseId,
    label: classNum === 1 ? `Turma A - ${courseName}` : `Turma B - ${courseName}`,
    schedule: classNum === 1
        ? [
            { day: 'MONDAY', start: '09:00', end: '11:00' },
            { day: 'WEDNESDAY', start: '09:00', end: '11:00' }
        ]
        : [
            { day: 'TUESDAY', start: '14:00', end: '16:00' },
            { day: 'THURSDAY', start: '14:00', end: '16:00' }
        ],
    capacity: 20,
    isActive: true
}));

// 20 Estudantes (4 por escola)
const STUDENTS = [
    // Escola 1
    {
        id: 'st1-001',
        fullName: 'Pedro Oliveira',
        birthDate: '2005-01-15',
        email: 'pedro.oliveira@example.com',
        phone: '11911111111',
        cpf: '74767131090',
        addressStreet: 'Rua A',
        addressNumber: '100',
        addressComplement: null,
        addressDistrict: 'Centro',
        addressCity: 'São Paulo',
        addressState: 'SP',
        addressZipCode: '01000000',
        persona: 'STUDENT',
        schoolIndex: 0
    },
    {
        id: 'st1-002',
        fullName: 'Julia Ferreira',
        birthDate: '2006-02-20',
        email: 'julia.ferreira@example.com',
        phone: '11911111112',
        cpf: '14329910004',
        addressStreet: 'Rua B',
        addressNumber: '200',
        addressComplement: 'Apto 101',
        addressDistrict: 'Centro',
        addressCity: 'São Paulo',
        addressState: 'SP',
        addressZipCode: '01000001',
        persona: 'STUDENT',
        schoolIndex: 0
    },
    {
        id: 'st1-003',
        fullName: 'Lucas Souza',
        birthDate: '2005-03-25',
        email: 'lucas.souza@example.com',
        phone: '11911111113',
        cpf: '65585863398',
        addressStreet: 'Rua C',
        addressNumber: '300',
        addressComplement: null,
        addressDistrict: 'Centro',
        addressCity: 'São Paulo',
        addressState: 'SP',
        addressZipCode: '01000002',
        persona: 'STUDENT',
        schoolIndex: 0
    },
    {
        id: 'st1-004',
        fullName: 'Mariana Lima',
        birthDate: '2006-04-10',
        email: 'mariana.lima@example.com',
        phone: '11911111114',
        cpf: '38623008626',
        addressStreet: 'Rua D',
        addressNumber: '400',
        addressComplement: 'Casa 2',
        addressDistrict: 'Centro',
        addressCity: 'São Paulo',
        addressState: 'SP',
        addressZipCode: '01000003',
        persona: 'STUDENT',
        schoolIndex: 0
    },
    // Escola 2
    {
        id: 'st2-001',
        fullName: 'Rafael Costa',
        birthDate: '2005-05-15',
        email: 'rafael.costa@example.com',
        phone: '11922222221',
        cpf: '27441452465',
        addressStreet: 'Rua E',
        addressNumber: '500',
        addressComplement: null,
        addressDistrict: 'Vila Nova',
        addressCity: 'São Paulo',
        addressState: 'SP',
        addressZipCode: '02000000',
        persona: 'STUDENT',
        schoolIndex: 1
    },
    {
        id: 'st2-002',
        fullName: 'Beatriz Rocha',
        birthDate: '2006-06-20',
        email: 'beatriz.rocha@example.com',
        phone: '11922222222',
        cpf: '93841698034',
        addressStreet: 'Rua F',
        addressNumber: '600',
        addressComplement: 'Apto 202',
        addressDistrict: 'Vila Nova',
        addressCity: 'São Paulo',
        addressState: 'SP',
        addressZipCode: '02000001',
        persona: 'STUDENT',
        schoolIndex: 1
    },
    {
        id: 'st2-003',
        fullName: 'Gabriel Martins',
        birthDate: '2005-07-25',
        email: 'gabriel.martins@example.com',
        phone: '11922222223',
        cpf: '93923953453',
        addressStreet: 'Rua G',
        addressNumber: '700',
        addressComplement: null,
        addressDistrict: 'Vila Nova',
        addressCity: 'São Paulo',
        addressState: 'SP',
        addressZipCode: '02000002',
        persona: 'STUDENT',
        schoolIndex: 1
    },
    {
        id: 'st2-004',
        fullName: 'Isabela Santos',
        birthDate: '2006-08-10',
        email: 'isabela.santos@example.com',
        phone: '11922222224',
        cpf: '70660152746',
        addressStreet: 'Rua H',
        addressNumber: '800',
        addressComplement: 'Bloco 1',
        addressDistrict: 'Vila Nova',
        addressCity: 'São Paulo',
        addressState: 'SP',
        addressZipCode: '02000003',
        persona: 'STUDENT',
        schoolIndex: 1
    },
    // Escola 3
    {
        id: 'st3-001',
        fullName: 'Felipe Almeida',
        birthDate: '2005-09-15',
        email: 'felipe.almeida@example.com',
        phone: '11933333331',
        cpf: '46673122544',
        addressStreet: 'Rua I',
        addressNumber: '900',
        addressComplement: null,
        addressDistrict: 'Jardim',
        addressCity: 'São Paulo',
        addressState: 'SP',
        addressZipCode: '03000000',
        persona: 'STUDENT',
        schoolIndex: 2
    },
    {
        id: 'st3-002',
        fullName: 'Carolina Pereira',
        birthDate: '2006-10-20',
        email: 'carolina.pereira@example.com',
        phone: '11933333332',
        cpf: '22531708529',
        addressStreet: 'Rua J',
        addressNumber: '1000',
        addressComplement: 'Apto 303',
        addressDistrict: 'Jardim',
        addressCity: 'São Paulo',
        addressState: 'SP',
        addressZipCode: '03000001',
        persona: 'STUDENT',
        schoolIndex: 2
    },
    {
        id: 'st3-003',
        fullName: 'Thiago Rodrigues',
        birthDate: '2005-11-25',
        email: 'thiago.rodrigues@example.com',
        phone: '11933333333',
        cpf: '98945001530',
        addressStreet: 'Rua K',
        addressNumber: '1100',
        addressComplement: null,
        addressDistrict: 'Jardim',
        addressCity: 'São Paulo',
        addressState: 'SP',
        addressZipCode: '03000002',
        persona: 'STUDENT',
        schoolIndex: 2
    },
    {
        id: 'st3-004',
        fullName: 'Amanda Barbosa',
        birthDate: '2006-12-10',
        email: 'amanda.barbosa@example.com',
        phone: '11933333334',
        cpf: '07929257428',
        addressStreet: 'Rua L',
        addressNumber: '1200',
        addressComplement: 'Casa 3',
        addressDistrict: 'Jardim',
        addressCity: 'São Paulo',
        addressState: 'SP',
        addressZipCode: '03000003',
        persona: 'STUDENT',
        schoolIndex: 2
    },
    // Escola 4
    {
        id: 'st4-001',
        fullName: 'Bruno Nunes',
        birthDate: '2005-01-15',
        email: 'bruno.nunes@example.com',
        phone: '11944444441',
        cpf: '44467822666',
        addressStreet: 'Rua M',
        addressNumber: '1300',
        addressComplement: null,
        addressDistrict: 'Parque',
        addressCity: 'São Paulo',
        addressState: 'SP',
        addressZipCode: '04000000',
        persona: 'STUDENT',
        schoolIndex: 3
    },
    {
        id: 'st4-002',
        fullName: 'Larissa Gomes',
        birthDate: '2006-02-20',
        email: 'larissa.gomes@example.com',
        phone: '11944444442',
        cpf: '26566411526',
        addressStreet: 'Rua N',
        addressNumber: '1400',
        addressComplement: 'Apto 404',
        addressDistrict: 'Parque',
        addressCity: 'São Paulo',
        addressState: 'SP',
        addressZipCode: '04000001',
        persona: 'STUDENT',
        schoolIndex: 3
    },
    {
        id: 'st4-003',
        fullName: 'Diego Cardoso',
        birthDate: '2005-03-25',
        email: 'diego.cardoso@example.com',
        phone: '11944444443',
        cpf: '20603591043',
        addressStreet: 'Rua O',
        addressNumber: '1500',
        addressComplement: null,
        addressDistrict: 'Parque',
        addressCity: 'São Paulo',
        addressState: 'SP',
        addressZipCode: '04000002',
        persona: 'STUDENT',
        schoolIndex: 3
    },
    {
        id: 'st4-004',
        fullName: 'Fernanda Araújo',
        birthDate: '2006-04-10',
        email: 'fernanda.araujo@example.com',
        phone: '11944444444',
        cpf: '90285377086',
        addressStreet: 'Rua P',
        addressNumber: '1600',
        addressComplement: 'Bloco 2',
        addressDistrict: 'Parque',
        addressCity: 'São Paulo',
        addressState: 'SP',
        addressZipCode: '04000003',
        persona: 'STUDENT',
        schoolIndex: 3
    },
    // Escola 5
    {
        id: 'st5-001',
        fullName: 'Ricardo Teixeira',
        birthDate: '2005-05-15',
        email: 'ricardo.teixeira@example.com',
        phone: '11955555551',
        cpf: '08931052286',
        addressStreet: 'Rua Q',
        addressNumber: '1700',
        addressComplement: null,
        addressDistrict: 'Alto',
        addressCity: 'São Paulo',
        addressState: 'SP',
        addressZipCode: '05000000',
        persona: 'STUDENT',
        schoolIndex: 4
    },
    {
        id: 'st5-002',
        fullName: 'Patricia Moura',
        birthDate: '2006-06-20',
        email: 'patricia.moura@example.com',
        phone: '11955555552',
        cpf: '96069062302',
        addressStreet: 'Rua R',
        addressNumber: '1800',
        addressComplement: 'Apto 505',
        addressDistrict: 'Alto',
        addressCity: 'São Paulo',
        addressState: 'SP',
        addressZipCode: '05000001',
        persona: 'STUDENT',
        schoolIndex: 4
    },
    {
        id: 'st5-003',
        fullName: 'Gustavo Lopes',
        birthDate: '2005-07-25',
        email: 'gustavo.lopes@example.com',
        phone: '11955555553',
        cpf: '25386189085',
        addressStreet: 'Rua S',
        addressNumber: '1900',
        addressComplement: null,
        addressDistrict: 'Alto',
        addressCity: 'São Paulo',
        addressState: 'SP',
        addressZipCode: '05000002',
        persona: 'STUDENT',
        schoolIndex: 4
    },
    {
        id: 'st5-004',
        fullName: 'Vanessa Ribeiro',
        birthDate: '2006-08-10',
        email: 'vanessa.ribeiro@example.com',
        phone: '11955555554',
        cpf: '21527929981',
        addressStreet: 'Rua T',
        addressNumber: '2000',
        addressComplement: 'Casa 4',
        addressDistrict: 'Alto',
        addressCity: 'São Paulo',
        addressState: 'SP',
        addressZipCode: '05000003',
        persona: 'STUDENT',
        schoolIndex: 4
    }
] as const;

// Matrículas: 4 estudantes por escola, distribuídos em 2 classes diferentes
const ENROLLMENTS = STUDENTS.map((student) => {
    const schoolIndex = student.schoolIndex;
    const school = SCHOOLS[schoolIndex];
    const schoolCourses = COURSES.filter(c => c.schoolId === school.id);
    
    // Encontrar o índice do estudante dentro da escola (0-3)
    const studentsInSchool = STUDENTS.filter(s => s.schoolIndex === schoolIndex);
    const studentIndexInSchool = studentsInSchool.findIndex(s => s.id === student.id);
    
    // Distribuir: estudantes 0 e 2 no primeiro curso, 1 e 3 no segundo
    const courseIndex = studentIndexInSchool < 2 ? 0 : 1;
    const course = schoolCourses[courseIndex];
    
    // Dentro do curso: estudantes 0 e 1 na primeira classe, 2 e 3 na segunda
    const classIndex = studentIndexInSchool % 2;
    const courseClasses = COURSE_CLASSES.filter(c => c.courseId === course.id);
    const courseClass = courseClasses[classIndex];
    
    // Gerar UUID v4 para matrícula
    return {
        id: randomUUID(),
        courseClassId: courseClass.id,
        ownerUserId: student.id,
        studentType: 'USER' as const,
        studentUserId: student.id,
        dependentId: null,
        status: 'ACTIVE' as const
    };
});

// 4 Enrollment Requests (convites abertos) para 4 escolas diferentes - UUIDs v4
const ENROLLMENT_REQUESTS = [
    {
        id: UUIDs.enrollmentRequests[0],
        schoolId: SCHOOLS[0].id,
        courseClassId: COURSE_CLASSES[0].id, // Primeira classe do primeiro curso da escola 1
        requestedForUserId: STUDENTS[0].id,
        requestedForDependentId: null,
        status: 'PENDING' as const,
        firstMonthlyPaymentDate: '2024-12-10',
        enrollmentFeeCents: 50000,
        enrollmentFeeDueDate: '2024-12-05'
    },
    {
        id: UUIDs.enrollmentRequests[1],
        schoolId: SCHOOLS[1].id,
        courseClassId: COURSE_CLASSES[4].id, // Primeira classe do primeiro curso da escola 2
        requestedForUserId: STUDENTS[4].id,
        requestedForDependentId: null,
        status: 'PENDING' as const,
        firstMonthlyPaymentDate: '2024-12-10',
        enrollmentFeeCents: 50000,
        enrollmentFeeDueDate: '2024-12-05'
    },
    {
        id: UUIDs.enrollmentRequests[2],
        schoolId: SCHOOLS[2].id,
        courseClassId: COURSE_CLASSES[8].id, // Primeira classe do primeiro curso da escola 3
        requestedForUserId: STUDENTS[8].id,
        requestedForDependentId: null,
        status: 'PENDING' as const,
        firstMonthlyPaymentDate: '2024-12-10',
        enrollmentFeeCents: 50000,
        enrollmentFeeDueDate: '2024-12-05'
    },
    {
        id: UUIDs.enrollmentRequests[3],
        schoolId: SCHOOLS[3].id,
        courseClassId: COURSE_CLASSES[12].id, // Primeira classe do primeiro curso da escola 4
        requestedForUserId: STUDENTS[12].id,
        requestedForDependentId: null,
        status: 'PENDING' as const,
        firstMonthlyPaymentDate: '2024-12-10',
        enrollmentFeeCents: 50000,
        enrollmentFeeDueDate: '2024-12-05'
    }
] as const;

// Cobranças financeiras para os estudantes
const FINANCIAL_CHARGES = ENROLLMENTS.flatMap((enrollment, index) => {
    const student = STUDENTS.find(s => s.id === enrollment.ownerUserId);
    if (!student) return [];
    
    const courseClass = COURSE_CLASSES.find(c => c.id === enrollment.courseClassId);
    const course = COURSES.find(c => c.id === courseClass?.courseId);
    const school = SCHOOLS.find(s => s.id === course?.schoolId);
    
    if (!course || !school) return [];
    
    // Criar algumas cobranças variadas para cada estudante
    const charges = [
        {
            id: randomUUID(),
            schoolId: school.id,
            ownerUserId: enrollment.ownerUserId,
            studentUserId: enrollment.studentUserId,
            dependentId: enrollment.dependentId,
            courseId: course.id,
            courseClassId: enrollment.courseClassId,
            chargeType: 'TUITION' as const,
            description: `Mensalidade - Novembro 2024`,
            amountCents: 35000,
            discountCents: null,
            discountReason: null,
            netAmountCents: 35000,
            dueDate: '2024-11-10',
            status: index % 3 === 0 ? 'PAID' as const : 'OPEN' as const,
            paidAt: index % 3 === 0 ? new Date('2024-11-08 10:00:00') : null
        },
        {
            id: randomUUID(),
            schoolId: school.id,
            ownerUserId: enrollment.ownerUserId,
            studentUserId: enrollment.studentUserId,
            dependentId: enrollment.dependentId,
            courseId: course.id,
            courseClassId: enrollment.courseClassId,
            chargeType: 'TUITION' as const,
            description: `Mensalidade - Dezembro 2024`,
            amountCents: 35000,
            discountCents: index % 4 === 0 ? 5000 : null,
            discountReason: index % 4 === 0 ? 'Desconto pontualidade' : null,
            netAmountCents: index % 4 === 0 ? 30000 : 35000,
            dueDate: '2024-12-10',
            status: 'OPEN' as const,
            paidAt: null
        },
        {
            id: randomUUID(),
            schoolId: school.id,
            ownerUserId: enrollment.ownerUserId,
            studentUserId: enrollment.studentUserId,
            dependentId: enrollment.dependentId,
            courseId: course.id,
            courseClassId: enrollment.courseClassId,
            chargeType: index % 2 === 0 ? 'MATERIALS' as const : 'ENROLLMENT' as const,
            description: index % 2 === 0 ? 'Material didático' : 'Taxa de matrícula',
            amountCents: index % 2 === 0 ? 12000 : 50000,
            discountCents: null,
            discountReason: null,
            netAmountCents: index % 2 === 0 ? 12000 : 50000,
            dueDate: index % 2 === 0 ? '2024-12-15' : '2024-11-05',
            status: index % 2 === 0 ? 'OPEN' as const : (index % 3 === 0 ? 'PAID' as const : 'OPEN' as const),
            paidAt: index % 2 === 0 ? null : (index % 3 === 0 ? new Date('2024-11-03 14:00:00') : null)
        }
    ];
    
    return charges;
});

export class SeedCompleteFlow1000000000038 implements MigrationInterface {
    name = 'SeedCompleteFlow1000000000038';

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Criar donos das escolas
        for (const owner of SCHOOL_OWNERS) {
            const existing = await queryRunner.query(
                'SELECT id FROM users WHERE id = ? OR cpf = ? OR email = ? LIMIT 1',
                [owner.id, owner.cpf, owner.email]
            );

            if (existing.length === 0) {
                await queryRunner.query(
                    `INSERT INTO users (
                        id, full_name, birth_date, email, phone, cpf,
                        address_street, address_number, address_complement,
                        address_district, address_city, address_state, address_zip_code,
                        persona, password_hash, created_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
                    [
                        owner.id, owner.fullName, owner.birthDate, owner.email, owner.phone, owner.cpf,
                        owner.addressStreet, owner.addressNumber, owner.addressComplement,
                        owner.addressDistrict, owner.addressCity, owner.addressState, owner.addressZipCode,
                        owner.persona, PASSWORD_HASH
                    ]
                );
            }
        }

        // Criar escolas
        for (const school of SCHOOLS) {
            const existing = await queryRunner.query(
                'SELECT id FROM schools WHERE id = ? OR cnpj = ? LIMIT 1',
                [school.id, school.cnpj]
            );

            if (existing.length === 0) {
                const owner = SCHOOL_OWNERS.find(o => o.id === school.ownerUserId);
                await queryRunner.query(
                    `INSERT INTO schools (
                        id, name, email, phone, cnpj,
                        owner_user_id, owner_name, owner_cpf, owner_email, owner_password_hash,
                        account_id, income_value, created_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
                    [
                        school.id, school.name, school.email, school.phone, school.cnpj,
                        school.ownerUserId, owner?.fullName, owner?.cpf, owner?.email, PASSWORD_HASH,
                        school.accountId, school.incomeValue
                    ]
                );
            }
        }

        // Criar endereços das escolas
        for (const address of SCHOOL_ADDRESSES) {
            const existing = await queryRunner.query(
                'SELECT id FROM school_addresses WHERE id = ? LIMIT 1',
                [address.id]
            );

            if (existing.length === 0) {
                await queryRunner.query(
                    `INSERT INTO school_addresses (
                        id, school_id, street, number, complement,
                        district, city, state, zip_code, created_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
                    [
                        address.id, address.schoolId, address.street, address.number, address.complement,
                        address.district, address.city, address.state, address.zipCode
                    ]
                );
            }
        }

        // Criar cursos
        for (const course of COURSES) {
            const existing = await queryRunner.query(
                'SELECT id FROM courses WHERE id = ? LIMIT 1',
                [course.id]
            );

            if (existing.length === 0) {
                await queryRunner.query(
                    `INSERT INTO courses (
                        id, school_id, name, description, is_active, created_at
                    ) VALUES (?, ?, ?, ?, ?, NOW())`,
                    [course.id, course.schoolId, course.name, course.description, course.isActive ? 1 : 0]
                );
            }
        }

        // Criar classes
        for (const courseClass of COURSE_CLASSES) {
            const existing = await queryRunner.query(
                'SELECT id FROM course_classes WHERE id = ? LIMIT 1',
                [courseClass.id]
            );

            if (existing.length === 0) {
                await queryRunner.query(
                    `INSERT INTO course_classes (
                        id, course_id, label, schedule, capacity, is_active, created_at
                    ) VALUES (?, ?, ?, ?, ?, ?, NOW())`,
                    [
                        courseClass.id, courseClass.courseId, courseClass.label,
                        JSON.stringify(courseClass.schedule), courseClass.capacity, courseClass.isActive ? 1 : 0
                    ]
                );
            }
        }

        // Criar estudantes
        for (const student of STUDENTS) {
            const existing = await queryRunner.query(
                'SELECT id FROM users WHERE id = ? OR cpf = ? OR email = ? LIMIT 1',
                [student.id, student.cpf, student.email]
            );

            if (existing.length === 0) {
                await queryRunner.query(
                    `INSERT INTO users (
                        id, full_name, birth_date, email, phone, cpf,
                        address_street, address_number, address_complement,
                        address_district, address_city, address_state, address_zip_code,
                        persona, password_hash, created_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
                    [
                        student.id, student.fullName, student.birthDate, student.email, student.phone, student.cpf,
                        student.addressStreet, student.addressNumber, student.addressComplement,
                        student.addressDistrict, student.addressCity, student.addressState, student.addressZipCode,
                        student.persona, PASSWORD_HASH
                    ]
                );
            }
        }

        // Criar matrículas
        for (const enrollment of ENROLLMENTS) {
            const existing = await queryRunner.query(
                'SELECT id FROM enrollments WHERE id = ? LIMIT 1',
                [enrollment.id]
            );

            if (existing.length === 0) {
                await queryRunner.query(
                    `INSERT INTO enrollments (
                        id, course_class_id, owner_user_id, student_type,
                        student_user_id, dependent_id, status, enrolled_at, updated_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
                    [
                        enrollment.id, enrollment.courseClassId, enrollment.ownerUserId, enrollment.studentType,
                        enrollment.studentUserId, enrollment.dependentId, enrollment.status
                    ]
                );
            }
        }

        // Criar enrollment requests (convites)
        for (const request of ENROLLMENT_REQUESTS) {
            const existing = await queryRunner.query(
                'SELECT id FROM enrollment_requests WHERE id = ? LIMIT 1',
                [request.id]
            );

            if (existing.length === 0) {
                await queryRunner.query(
                    `INSERT INTO enrollment_requests (
                        id, school_id, course_class_id, requested_for_user_id,
                        requested_for_dependent_id, status, first_monthly_payment_date,
                        enrollment_fee_cents, enrollment_fee_due_date, created_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
                    [
                        request.id, request.schoolId, request.courseClassId, request.requestedForUserId,
                        request.requestedForDependentId, request.status, request.firstMonthlyPaymentDate,
                        request.enrollmentFeeCents, request.enrollmentFeeDueDate
                    ]
                );
            }
        }

        // Criar cobranças financeiras
        for (const charge of FINANCIAL_CHARGES) {
            const existing = await queryRunner.query(
                'SELECT id FROM school_financial_charges WHERE id = ? LIMIT 1',
                [charge.id]
            );

            if (existing.length === 0) {
                await queryRunner.query(
                    `INSERT INTO school_financial_charges (
                        id, school_id, owner_user_id, student_user_id, dependent_id,
                        course_id, course_class_id, charge_type, description,
                        amount_cents, discount_cents, discount_reason, net_amount_cents,
                        due_date, status, paid_at, created_at, updated_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
                    [
                        charge.id, charge.schoolId, charge.ownerUserId, charge.studentUserId, charge.dependentId,
                        charge.courseId, charge.courseClassId, charge.chargeType, charge.description,
                        charge.amountCents, charge.discountCents, charge.discountReason, charge.netAmountCents,
                        charge.dueDate, charge.status, charge.paidAt
                    ]
                );
            }
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Remover cobranças
        const chargeIds = FINANCIAL_CHARGES.map(c => c.id);
        if (chargeIds.length > 0) {
            const placeholders = chargeIds.map(() => '?').join(',');
            await queryRunner.query(
                `DELETE FROM school_financial_charges WHERE id IN (${placeholders})`,
                chargeIds
            );
        }

        // Remover enrollment requests
        const requestIds = ENROLLMENT_REQUESTS.map(r => r.id);
        if (requestIds.length > 0) {
            const placeholders = requestIds.map(() => '?').join(',');
            await queryRunner.query(
                `DELETE FROM enrollment_requests WHERE id IN (${placeholders})`,
                requestIds
            );
        }

        // Remover matrículas
        const enrollmentIds = ENROLLMENTS.map(e => e.id);
        if (enrollmentIds.length > 0) {
            const placeholders = enrollmentIds.map(() => '?').join(',');
            await queryRunner.query(
                `DELETE FROM enrollments WHERE id IN (${placeholders})`,
                enrollmentIds
            );
        }

        // Remover estudantes
        const studentIds = STUDENTS.map(s => s.id);
        if (studentIds.length > 0) {
            const placeholders = studentIds.map(() => '?').join(',');
            await queryRunner.query(
                `DELETE FROM users WHERE id IN (${placeholders})`,
                studentIds
            );
        }

        // Remover classes
        const classIds = COURSE_CLASSES.map(c => c.id);
        if (classIds.length > 0) {
            const placeholders = classIds.map(() => '?').join(',');
            await queryRunner.query(
                `DELETE FROM course_classes WHERE id IN (${placeholders})`,
                classIds
            );
        }

        // Remover cursos
        const courseIds = COURSES.map(c => c.id);
        if (courseIds.length > 0) {
            const placeholders = courseIds.map(() => '?').join(',');
            await queryRunner.query(
                `DELETE FROM courses WHERE id IN (${placeholders})`,
                courseIds
            );
        }

        // Remover endereços das escolas
        const addressIds = SCHOOL_ADDRESSES.map(a => a.id);
        if (addressIds.length > 0) {
            const placeholders = addressIds.map(() => '?').join(',');
            await queryRunner.query(
                `DELETE FROM school_addresses WHERE id IN (${placeholders})`,
                addressIds
            );
        }

        // Remover escolas
        const schoolIds = SCHOOLS.map(s => s.id);
        if (schoolIds.length > 0) {
            const placeholders = schoolIds.map(() => '?').join(',');
            await queryRunner.query(
                `DELETE FROM schools WHERE id IN (${placeholders})`,
                schoolIds
            );
        }

        // Remover donos das escolas
        const ownerIds = SCHOOL_OWNERS.map(o => o.id);
        if (ownerIds.length > 0) {
            const placeholders = ownerIds.map(() => '?').join(',');
            await queryRunner.query(
                `DELETE FROM users WHERE id IN (${placeholders})`,
                ownerIds
            );
        }
    }
}

