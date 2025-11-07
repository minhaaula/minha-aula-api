import { MigrationInterface, QueryRunner } from 'typeorm';

const ADMIN_USER = {
    id: '00000000-0000-0000-0000-000000000001',
    fullName: 'Administrador',
    birthDate: '1990-01-01',
    email: 'admin@payments-api.com',
    phone: '11999999999',
    cpf: '00000000000',
    addressStreet: 'Rua Admin',
    addressNumber: '1',
    addressComplement: null,
    addressDistrict: 'Centro',
    addressCity: 'São Paulo',
    addressState: 'SP',
    addressZipCode: '01000000',
    persona: 'ADMIN',
    passwordHash: 'ca34a4b1bf816befb5b0562a05e10915:76ac9c18e8e053bb10a6ac546e2d88136cd2bd2dea0b77ab96d85664c127490a810f60d060c5114bb8b9f4337f5104b3083df94957060efa7363787c67a03cd7'
} as const;

export class SeedAdminUser1000000000029 implements MigrationInterface {
    name = 'SeedAdminUser1000000000029';

    public async up(queryRunner: QueryRunner): Promise<void> {
        const existing = await queryRunner.query(
            'SELECT id FROM users WHERE id = ? OR cpf = ? OR email = ? LIMIT 1',
            [ADMIN_USER.id, ADMIN_USER.cpf, ADMIN_USER.email]
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
                    ADMIN_USER.id,
                    ADMIN_USER.fullName,
                    ADMIN_USER.birthDate,
                    ADMIN_USER.email,
                    ADMIN_USER.phone,
                    ADMIN_USER.cpf,
                    ADMIN_USER.addressStreet,
                    ADMIN_USER.addressNumber,
                    ADMIN_USER.addressComplement,
                    ADMIN_USER.addressDistrict,
                    ADMIN_USER.addressCity,
                    ADMIN_USER.addressState,
                    ADMIN_USER.addressZipCode,
                    ADMIN_USER.persona,
                    ADMIN_USER.passwordHash
                ]
            );
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            'DELETE FROM users WHERE id = ?',
            [ADMIN_USER.id]
        );
    }
}

