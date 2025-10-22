import { MigrationInterface, QueryRunner } from 'typeorm';

const PASSWORD_HASH = 'b1a45f1c9d8e4f1b8cacbb16b6e0e337:2e07f75b342bff606fac2e124835c74b4aae3b55b37c56e0613e1093a7cce955afcc00dd8eb9c9a7b60f86194da09431ccba0eeea5f7914ac125af85d285572b';

const USERS = [
    {
        id: '8f3e8f02-0bd7-4f47-828c-6ec1345ca901',
        fullName: 'Marcos Oliveira',
        birthDate: '1982-05-14',
        email: 'marcos.oliveira@colegiofuturodemo.com',
        phone: '11912345678',
        cpf: '32165498701',
        addressStreet: 'Rua das Acácias',
        addressNumber: '250',
        addressComplement: 'Casa 2',
        addressDistrict: 'Jardins',
        addressCity: 'São Paulo',
        addressState: 'SP',
        addressZipCode: '04534011',
        persona: 'SCHOOL'
    },
    {
        id: '6a2f6a2e-58f1-4c80-b533-d5d5a8cb1f01',
        fullName: 'Ana Pereira',
        birthDate: '1985-09-12',
        email: 'ana.pereira@example.com',
        phone: '11999990001',
        cpf: '38572964012',
        addressStreet: 'Rua São Bento',
        addressNumber: '812',
        addressComplement: null,
        addressDistrict: 'Centro',
        addressCity: 'São Paulo',
        addressState: 'SP',
        addressZipCode: '01010900',
        persona: 'STUDENT'
    },
    {
        id: '0b1d8930-0b35-4deb-9c4c-48ee3e60a8f8',
        fullName: 'Bruno Costa',
        birthDate: '2006-03-22',
        email: 'bruno.costa@example.com',
        phone: '11999990002',
        cpf: '50276893045',
        addressStreet: 'Avenida Paulista',
        addressNumber: '1578',
        addressComplement: 'Ap 1103',
        addressDistrict: 'Bela Vista',
        addressCity: 'São Paulo',
        addressState: 'SP',
        addressZipCode: '01310200',
        persona: 'STUDENT'
    }
] as const;

const SCHOOL = {
    id: 'd3da8696-1f9b-4bbd-954e-7ad6b5dd5a5d',
    name: 'Colégio Futuro Demo',
    email: 'contato@colegiofuturodemo.com',
    phone: '1133224455',
    cnpj: '12345678000199',
    ownerUserId: USERS[0].id,
    ownerName: USERS[0].fullName,
    ownerCpf: USERS[0].cpf,
    ownerEmail: USERS[0].email,
    ownerPasswordHash: PASSWORD_HASH,
    accountId: 'acc-demo-001',
    incomeValue: 15000
} as const;

const SCHOOL_ADDRESSES = [
    {
        id: 'bb7cd511-e53e-4906-bce1-4c04d2d5cbd8',
        schoolId: SCHOOL.id,
        street: 'Rua das Flores',
        number: '123',
        complement: 'Bloco A',
        district: 'Centro',
        city: 'São Paulo',
        state: 'SP',
        zipCode: '01001000'
    }
] as const;

const COURSES = [
    {
        id: '7e5e2f2b-3f85-4eef-9c9f-4c8f1ca23d3c',
        schoolId: SCHOOL.id,
        name: 'Programação para Iniciantes',
        description: 'Curso introdutório de lógica e programação voltado para jovens estudantes.',
        isActive: true
    }
] as const;

const COURSE_CLASSES = [
    {
        id: 'e6c5f4d9-2d5f-4f22-9f4a-0d3a50ba3b2c',
        courseId: COURSES[0].id,
        label: 'Turma A - Manhã',
        schedule: [
            { day: 'TUESDAY', start: '09:00', end: '10:30' },
            { day: 'THURSDAY', start: '09:00', end: '10:30' }
        ],
        capacity: 20,
        isActive: true
    }
] as const;

const DEPENDENTS = [
    {
        id: '54b9b7ae-593b-4bf9-98ab-85f1bde0971d',
        userId: USERS[1].id,
        fullName: 'Lucas Pereira',
        birthDate: '2012-07-05',
        relationship: 'Filho'
    }
] as const;

const ENROLLMENTS = [
    {
        id: 'f12c9c9d-531c-4acf-8bc2-bd0ec061f318',
        courseClassId: COURSE_CLASSES[0].id,
        ownerUserId: USERS[1].id,
        studentType: 'DEPENDENT' as const,
        studentUserId: null,
        dependentId: DEPENDENTS[0].id,
        status: 'ACTIVE'
    },
    {
        id: '28f2a87c-37e2-4a71-8364-55ce49963cf0',
        courseClassId: COURSE_CLASSES[0].id,
        ownerUserId: USERS[2].id,
        studentType: 'USER' as const,
        studentUserId: USERS[2].id,
        dependentId: null,
        status: 'ACTIVE'
    }
] as const;

export class SeedDemoSchool1000000000021 implements MigrationInterface {
    name = 'SeedDemoSchool1000000000021';

    public async up(queryRunner: QueryRunner): Promise<void> {
        for (const user of USERS) {
            const existing = await queryRunner.query(
                'SELECT id FROM users WHERE id = ? OR cpf = ? OR email = ? LIMIT 1',
                [user.id, user.cpf, user.email]
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
                        user.id,
                        user.fullName,
                        user.birthDate,
                        user.email,
                        user.phone,
                        user.cpf,
                        user.addressStreet,
                        user.addressNumber,
                        user.addressComplement,
                        user.addressDistrict,
                        user.addressCity,
                        user.addressState,
                        user.addressZipCode,
                        user.persona,
                        PASSWORD_HASH
                    ]
                );
            }
        }

        const existingSchool = await queryRunner.query(
            'SELECT id FROM schools WHERE id = ? OR cnpj = ? LIMIT 1',
            [SCHOOL.id, SCHOOL.cnpj]
        );

        if (existingSchool.length === 0) {
            await queryRunner.query(
                `INSERT INTO schools (
                    id,
                    name,
                    email,
                    phone,
                    cnpj,
                    owner_user_id,
                    owner_name,
                    owner_cpf,
                    owner_email,
                    owner_password_hash,
                    account_id,
                    income_value,
                    created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
                [
                    SCHOOL.id,
                    SCHOOL.name,
                    SCHOOL.email,
                    SCHOOL.phone,
                    SCHOOL.cnpj,
                    SCHOOL.ownerUserId,
                    SCHOOL.ownerName,
                    SCHOOL.ownerCpf,
                    SCHOOL.ownerEmail,
                    SCHOOL.ownerPasswordHash,
                    SCHOOL.accountId,
                    SCHOOL.incomeValue
                ]
            );
        }

        for (const address of SCHOOL_ADDRESSES) {
            const existingAddress = await queryRunner.query(
                'SELECT id FROM school_addresses WHERE id = ? LIMIT 1',
                [address.id]
            );

            if (existingAddress.length === 0) {
                await queryRunner.query(
                    `INSERT INTO school_addresses (
                        id,
                        school_id,
                        street,
                        number,
                        complement,
                        district,
                        city,
                        state,
                        zip_code,
                        created_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
                    [
                        address.id,
                        address.schoolId,
                        address.street,
                        address.number,
                        address.complement,
                        address.district,
                        address.city,
                        address.state,
                        address.zipCode
                    ]
                );
            }
        }

        for (const course of COURSES) {
            const existingCourse = await queryRunner.query(
                'SELECT id FROM courses WHERE id = ? OR (school_id = ? AND name = ?) LIMIT 1',
                [course.id, course.schoolId, course.name]
            );

            if (existingCourse.length === 0) {
                await queryRunner.query(
                    `INSERT INTO courses (
                        id,
                        school_id,
                        name,
                        description,
                        is_active,
                        created_at
                    ) VALUES (?, ?, ?, ?, ?, NOW())`,
                    [
                        course.id,
                        course.schoolId,
                        course.name,
                        course.description,
                        course.isActive ? 1 : 0
                    ]
                );
            }
        }

        for (const courseClass of COURSE_CLASSES) {
            const existingClass = await queryRunner.query(
                'SELECT id FROM course_classes WHERE id = ? OR (course_id = ? AND label = ?) LIMIT 1',
                [courseClass.id, courseClass.courseId, courseClass.label]
            );

            if (existingClass.length === 0) {
                await queryRunner.query(
                    `INSERT INTO course_classes (
                        id,
                        course_id,
                        label,
                        schedule,
                        capacity,
                        is_active,
                        created_at
                    ) VALUES (?, ?, ?, ?, ?, ?, NOW())`,
                    [
                        courseClass.id,
                        courseClass.courseId,
                        courseClass.label,
                        JSON.stringify(courseClass.schedule),
                        courseClass.capacity,
                        courseClass.isActive ? 1 : 0
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

        for (const enrollment of ENROLLMENTS) {
            const existingEnrollment = await queryRunner.query(
                'SELECT id FROM enrollments WHERE id = ? LIMIT 1',
                [enrollment.id]
            );

            if (existingEnrollment.length === 0) {
                await queryRunner.query(
                    `INSERT INTO enrollments (
                        id,
                        course_class_id,
                        owner_user_id,
                        student_type,
                        student_user_id,
                        dependent_id,
                        status,
                        enrolled_at,
                        updated_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
                    [
                        enrollment.id,
                        enrollment.courseClassId,
                        enrollment.ownerUserId,
                        enrollment.studentType,
                        enrollment.studentUserId,
                        enrollment.dependentId,
                        enrollment.status
                    ]
                );
            }
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        const enrollmentIds = ENROLLMENTS.map((enrollment) => enrollment.id);
        if (enrollmentIds.length > 0) {
            const placeholders = enrollmentIds.map(() => '?').join(',');
            await queryRunner.query(
                `DELETE FROM enrollments WHERE id IN (${placeholders})`,
                enrollmentIds
            );
        }

        const dependentIds = DEPENDENTS.map((dependent) => dependent.id);
        if (dependentIds.length > 0) {
            const placeholders = dependentIds.map(() => '?').join(',');
            await queryRunner.query(
                `DELETE FROM dependents WHERE id IN (${placeholders})`,
                dependentIds
            );
        }

        const classIds = COURSE_CLASSES.map((courseClass) => courseClass.id);
        if (classIds.length > 0) {
            const placeholders = classIds.map(() => '?').join(',');
            await queryRunner.query(
                `DELETE FROM course_classes WHERE id IN (${placeholders})`,
                classIds
            );
        }

        const courseIds = COURSES.map((course) => course.id);
        if (courseIds.length > 0) {
            const placeholders = courseIds.map(() => '?').join(',');
            await queryRunner.query(
                `DELETE FROM courses WHERE id IN (${placeholders})`,
                courseIds
            );
        }

        const addressIds = SCHOOL_ADDRESSES.map((address) => address.id);
        if (addressIds.length > 0) {
            const placeholders = addressIds.map(() => '?').join(',');
            await queryRunner.query(
                `DELETE FROM school_addresses WHERE id IN (${placeholders})`,
                addressIds
            );
        }

        await queryRunner.query(
            'DELETE FROM schools WHERE id = ?',
            [SCHOOL.id]
        );

        const userIds = USERS.map((user) => user.id);
        if (userIds.length > 0) {
            const placeholders = userIds.map(() => '?').join(',');
            await queryRunner.query(
                `DELETE FROM users WHERE id IN (${placeholders})`,
                userIds
            );
        }
    }
}
