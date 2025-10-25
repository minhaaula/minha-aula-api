import { MigrationInterface, QueryRunner } from 'typeorm';

const PASSWORD_HASH =
    'b1a45f1c9d8e4f1b8cacbb16b6e0e337:2e07f75b342bff606fac2e124835c74b4aae3b55b37c56e0613e1093a7cce955afcc00dd8eb9c9a7b60f86194da09431ccba0eeea5f7914ac125af85d285572b';

const STUDENTS = [
    {
        id: '2f5a90d5-063f-4c0f-9c8b-9361cfe0d061',
        fullName: 'Gabriela Martins',
        birthDate: '2004-11-02',
        email: 'gabriela.martins@example.com',
        phone: '11988880011',
        cpf: '61728394015',
        addressStreet: 'Rua das Laranjeiras',
        addressNumber: '45',
        addressComplement: null,
        addressDistrict: 'Moema',
        addressCity: 'São Paulo',
        addressState: 'SP',
        addressZipCode: '04076000'
    },
    {
        id: '5f8a0b3e-9f79-4d54-85e4-cb8468e5c5d2',
        fullName: 'Thiago Moreira',
        birthDate: '2003-04-18',
        email: 'thiago.moreira@example.com',
        phone: '11988880012',
        cpf: '42819657036',
        addressStreet: 'Rua Boa Vista',
        addressNumber: '980',
        addressComplement: 'Ap 802',
        addressDistrict: 'Centro',
        addressCity: 'São Paulo',
        addressState: 'SP',
        addressZipCode: '01014000'
    },
    {
        id: 'e6a4f1f9-9428-4d8a-a246-47eb1fa4e821',
        fullName: 'Natália Freitas',
        birthDate: '2005-08-27',
        email: 'natalia.freitas@example.com',
        phone: '11988880013',
        cpf: '53927461058',
        addressStreet: 'Rua das Pitangueiras',
        addressNumber: '312',
        addressComplement: 'Casa 1',
        addressDistrict: 'Vila Mariana',
        addressCity: 'São Paulo',
        addressState: 'SP',
        addressZipCode: '04128000'
    },
    {
        id: '3a5d6e7f-82b4-4d7c-8f1a-2c3b4d5e6f70',
        fullName: 'Lucas Henrique',
        birthDate: '2006-01-09',
        email: 'lucas.henrique@example.com',
        phone: '11988880014',
        cpf: '75081643920',
        addressStreet: 'Rua Dona Veridiana',
        addressNumber: '67',
        addressComplement: null,
        addressDistrict: 'Santa Cecília',
        addressCity: 'São Paulo',
        addressState: 'SP',
        addressZipCode: '01238010'
    },
    {
        id: '94d3bc60-61d9-4368-9167-d49780865ea5',
        fullName: 'Elisa Castro',
        birthDate: '2004-06-30',
        email: 'elisa.castro@example.com',
        phone: '11988880015',
        cpf: '86253917047',
        addressStreet: 'Rua das Mangueiras',
        addressNumber: '210',
        addressComplement: 'Bloco B',
        addressDistrict: 'Butantã',
        addressCity: 'São Paulo',
        addressState: 'SP',
        addressZipCode: '05502010'
    },
    {
        id: 'b4e6c8d2-7f3a-4d9b-9e1c-2f4a6b8c0d12',
        fullName: 'Luiza Almeida',
        birthDate: '1988-02-15',
        email: 'luiza.almeida@example.com',
        phone: '11988880016',
        cpf: '19368542079',
        addressStreet: 'Rua Cardeal Arcoverde',
        addressNumber: '450',
        addressComplement: 'Ap 301',
        addressDistrict: 'Pinheiros',
        addressCity: 'São Paulo',
        addressState: 'SP',
        addressZipCode: '05407002'
    },
    {
        id: 'd315e7fa-8c9b-4a2d-9e1f-0a1b2c3d4e5f',
        fullName: 'Pedro Nogueira',
        birthDate: '1986-10-21',
        email: 'pedro.nogueira@example.com',
        phone: '11988880017',
        cpf: '28467193058',
        addressStreet: 'Rua Heitor Penteado',
        addressNumber: '1022',
        addressComplement: null,
        addressDistrict: 'Sumaré',
        addressCity: 'São Paulo',
        addressState: 'SP',
        addressZipCode: '05438000'
    }
] as const;

const DEPENDENTS = [
    {
        id: '4c9c1c88-089e-4f60-9e97-4588deccadf4',
        userId: 'b4e6c8d2-7f3a-4d9b-9e1c-2f4a6b8c0d12',
        fullName: 'Rafael Almeida',
        birthDate: '2015-05-12',
        relationship: 'Filho'
    },
    {
        id: '6d2fc1a2-9731-4800-8f0d-34374d7d8e9a',
        userId: 'd315e7fa-8c9b-4a2d-9e1f-0a1b2c3d4e5f',
        fullName: 'Camila Nogueira',
        birthDate: '2013-09-03',
        relationship: 'Filha'
    }
] as const;

export class SeedExtraDemoStudents1000000000023 implements MigrationInterface {
    name = 'SeedExtraDemoStudents1000000000023';

    public async up(queryRunner: QueryRunner): Promise<void> {
        for (const student of STUDENTS) {
            const existing = await queryRunner.query(
                'SELECT id FROM users WHERE id = ? OR cpf = ? OR email = ? LIMIT 1',
                [student.id, student.cpf, student.email]
            );

            if (existing.length === 0) {
                await queryRunner.query(
                    `INSERT INTO users (
                        id,
                        full_name,
                        birth_date,
                        email,
                        phone,
                        cpf,
                        address_street,
                        address_number,
                        address_complement,
                        address_district,
                        address_city,
                        address_state,
                        address_zip_code,
                        persona,
                        password_hash,
                        created_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
                    [
                        student.id,
                        student.fullName,
                        student.birthDate,
                        student.email,
                        student.phone,
                        student.cpf,
                        student.addressStreet,
                        student.addressNumber,
                        student.addressComplement,
                        student.addressDistrict,
                        student.addressCity,
                        student.addressState,
                        student.addressZipCode,
                        'STUDENT',
                        PASSWORD_HASH
                    ]
                );
            }
        }

        for (const dependent of DEPENDENTS) {
            const existingDependent = await queryRunner.query(
                'SELECT id FROM dependents WHERE id = ? OR (user_id = ? AND full_name = ?) LIMIT 1',
                [dependent.id, dependent.userId, dependent.fullName]
            );

            if (existingDependent.length === 0) {
                await queryRunner.query(
                    `INSERT INTO dependents (
                        id,
                        user_id,
                        full_name,
                        birth_date,
                        relationship,
                        created_at
                    ) VALUES (?, ?, ?, ?, ?, NOW())`,
                    [
                        dependent.id,
                        dependent.userId,
                        dependent.fullName,
                        dependent.birthDate,
                        dependent.relationship
                    ]
                );
            }
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        const dependentIds = DEPENDENTS.map((dependent) => dependent.id);
        if (dependentIds.length > 0) {
            const placeholders = dependentIds.map(() => '?').join(',');
            await queryRunner.query(`DELETE FROM dependents WHERE id IN (${placeholders})`, dependentIds);
        }

        const studentIds = STUDENTS.map((student) => student.id);
        if (studentIds.length > 0) {
            const placeholders = studentIds.map(() => '?').join(',');
            await queryRunner.query(`DELETE FROM users WHERE id IN (${placeholders})`, studentIds);
        }
    }
}

