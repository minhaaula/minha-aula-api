import { MigrationInterface, QueryRunner } from 'typeorm';

// IDs dos seeds anteriores
const SCHOOL_ID = 'd3da8696-1f9b-4bbd-954e-7ad6b5dd5a5d'; // Colégio Futuro Demo
const COURSE_ID = '7e5e2f2b-3f85-4eef-9c9f-4c8f1ca23d3c'; // Programação para Iniciantes
const COURSE_CLASS_ID = 'e6c5f4d9-2d5f-4f22-9f4a-0d3a50ba3b2c'; // Turma A - Manhã

// Estudantes USER (do seed-approved-students)
const STUDENT_USER_CHARGES = [
    {
        studentUserId: '2f5a90d5-063f-4c0f-9c8b-9361cfe0d061', // Gabriela Martins
        charges: [
            {
                chargeType: 'TUITION',
                description: 'Mensalidade - Janeiro 2024',
                amountCents: 35000, // R$ 350,00
                discountCents: null,
                discountReason: null,
                dueDate: '2024-01-10',
                status: 'PAID',
                paidAt: '2024-01-08 10:30:00' as string | null
            },
            {
                chargeType: 'TUITION',
                description: 'Mensalidade - Fevereiro 2024',
                amountCents: 35000,
                discountCents: null,
                discountReason: null,
                dueDate: '2024-02-10',
                status: 'PAID',
                paidAt: '2024-02-05 14:20:00' as string | null
            },
            {
                chargeType: 'TUITION',
                description: 'Mensalidade - Março 2024',
                amountCents: 35000,
                discountCents: 5000, // R$ 50,00 de desconto
                discountReason: 'Desconto pontualidade',
                dueDate: '2024-03-10',
                status: 'OPEN',
                paidAt: null as string | null
            },
            {
                chargeType: 'MATERIALS',
                description: 'Material didático - Kit completo',
                amountCents: 12000, // R$ 120,00
                discountCents: null,
                discountReason: null,
                dueDate: '2024-03-15',
                status: 'OPEN',
                paidAt: null as string | null
            }
        ]
    },
    {
        studentUserId: '5f8a0b3e-9f79-4d54-85e4-cb8468e5c5d2', // Thiago Moreira
        charges: [
            {
                chargeType: 'TUITION',
                description: 'Mensalidade - Janeiro 2024',
                amountCents: 35000,
                discountCents: null,
                discountReason: null,
                dueDate: '2024-01-10',
                status: 'PAID',
                paidAt: '2024-01-09 16:45:00' as string | null
            },
            {
                chargeType: 'TUITION',
                description: 'Mensalidade - Fevereiro 2024',
                amountCents: 35000,
                discountCents: null,
                discountReason: null,
                dueDate: '2024-02-10',
                status: 'OVERDUE',
                paidAt: null as string | null
            },
            {
                chargeType: 'ENROLLMENT',
                description: 'Taxa de matrícula',
                amountCents: 50000, // R$ 500,00
                discountCents: 10000, // R$ 100,00 de desconto
                discountReason: 'Desconto primeiro semestre',
                dueDate: '2024-01-05',
                status: 'PAID',
                paidAt: '2024-01-03 11:15:00' as string | null
            }
        ]
    },
    {
        studentUserId: 'e6a4f1f9-9428-4d8a-a246-47eb1fa4e821', // Elisa Castro
        charges: [
            {
                chargeType: 'TUITION',
                description: 'Mensalidade - Janeiro 2024',
                amountCents: 35000,
                discountCents: null,
                discountReason: null,
                dueDate: '2024-01-10',
                status: 'OPEN',
                paidAt: null as string | null
            },
            {
                chargeType: 'TUITION',
                description: 'Mensalidade - Fevereiro 2024',
                amountCents: 35000,
                discountCents: null,
                discountReason: null,
                dueDate: '2024-02-10',
                status: 'OPEN',
                paidAt: null as string | null
            },
            {
                chargeType: 'DAILY',
                description: 'Aula avulsa - Workshop Python',
                amountCents: 8000, // R$ 80,00
                discountCents: null,
                discountReason: null,
                dueDate: '2024-02-20',
                status: 'PAID',
                paidAt: '2024-02-18 09:30:00' as string | null
            }
        ]
    }
] as const;

// Dependentes (do seed-approved-students)
const DEPENDENT_CHARGES = [
    {
        dependentId: '4c9c1c88-089e-4f60-9e97-4588deccadf4', // Rafael Almeida
        ownerUserId: 'b4e6c8d2-7f3a-4d9b-9e1c-2f4a6b8c0d12', // Luiza Almeida (mãe)
        charges: [
            {
                chargeType: 'TUITION',
                description: 'Mensalidade - Janeiro 2024',
                amountCents: 35000,
                discountCents: null,
                discountReason: null,
                dueDate: '2024-01-10',
                status: 'PAID',
                paidAt: '2024-01-07 13:20:00' as string | null
            },
            {
                chargeType: 'TUITION',
                description: 'Mensalidade - Fevereiro 2024',
                amountCents: 35000,
                discountCents: null,
                discountReason: null,
                dueDate: '2024-02-10',
                status: 'PAID',
                paidAt: '2024-02-06 15:10:00' as string | null
            },
            {
                chargeType: 'TUITION',
                description: 'Mensalidade - Março 2024',
                amountCents: 35000,
                discountCents: null,
                discountReason: null,
                dueDate: '2024-03-10',
                status: 'OPEN',
                paidAt: null as string | null
            },
            {
                chargeType: 'MATERIALS',
                description: 'Material didático - Livro de exercícios',
                amountCents: 4500, // R$ 45,00
                discountCents: null,
                discountReason: null,
                dueDate: '2024-03-12',
                status: 'OPEN',
                paidAt: null as string | null
            }
        ]
    },
    {
        dependentId: '6d2fc1a2-9731-4800-8f0d-34374d7d8e9a', // Camila Nogueira
        ownerUserId: 'd315e7fa-8c9b-4a2d-9e1f-0a1b2c3d4e5f', // Pedro Nogueira (pai)
        charges: [
            {
                chargeType: 'ENROLLMENT',
                description: 'Taxa de matrícula',
                amountCents: 50000,
                discountCents: null,
                discountReason: null,
                dueDate: '2024-01-05',
                status: 'PAID',
                paidAt: '2024-01-02 10:00:00' as string | null
            },
            {
                chargeType: 'TUITION',
                description: 'Mensalidade - Janeiro 2024',
                amountCents: 35000,
                discountCents: null,
                discountReason: null,
                dueDate: '2024-01-10',
                status: 'PAID',
                paidAt: '2024-01-08 12:30:00' as string | null
            },
            {
                chargeType: 'TUITION',
                description: 'Mensalidade - Fevereiro 2024',
                amountCents: 35000,
                discountCents: 7000, // R$ 70,00 de desconto
                discountReason: 'Desconto família',
                dueDate: '2024-02-10',
                status: 'OPEN',
                paidAt: null as string | null
            }
        ]
    }
] as const;

export class SeedSchoolPayments1000000000028 implements MigrationInterface {
    name = 'SeedSchoolPayments1000000000028';

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Verificar se a escola existe
        const school = await queryRunner.query(
            'SELECT id FROM schools WHERE id = ? LIMIT 1',
            [SCHOOL_ID]
        );

        if (school.length === 0) {
            console.warn(`School ${SCHOOL_ID} not found. Skipping payment charges creation.`);
            return;
        }

        // Verificar se o curso existe
        const course = await queryRunner.query(
            'SELECT id FROM courses WHERE id = ? LIMIT 1',
            [COURSE_ID]
        );

        if (course.length === 0) {
            console.warn(`Course ${COURSE_ID} not found. Skipping payment charges creation.`);
            return;
        }

        // Criar charges para estudantes USER
        for (const { studentUserId, charges } of STUDENT_USER_CHARGES) {
            // Verificar se o estudante existe
            const student = await queryRunner.query(
                'SELECT id FROM users WHERE id = ? AND persona = ? LIMIT 1',
                [studentUserId, 'STUDENT']
            );

            if (student.length === 0) {
                console.warn(`Student user ${studentUserId} not found. Skipping charges.`);
                continue;
            }

            for (const charge of charges) {
                const chargeId = require('node:crypto').randomUUID();
                const netAmountCents = charge.amountCents - (charge.discountCents ?? 0);

                await queryRunner.query(
                    `INSERT INTO school_financial_charges (
                        id,
                        school_id,
                        owner_user_id,
                        student_user_id,
                        dependent_id,
                        course_id,
                        course_class_id,
                        charge_type,
                        description,
                        amount_cents,
                        discount_cents,
                        discount_reason,
                        net_amount_cents,
                        due_date,
                        status,
                        paid_at,
                        created_at,
                        updated_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
                    [
                        chargeId,
                        SCHOOL_ID,
                        studentUserId, // owner é o próprio estudante
                        studentUserId,
                        null,
                        COURSE_ID,
                        COURSE_CLASS_ID,
                        charge.chargeType,
                        charge.description,
                        charge.amountCents,
                        charge.discountCents,
                        charge.discountReason,
                        netAmountCents,
                        charge.dueDate,
                        charge.status,
                        charge.paidAt ? new Date(charge.paidAt) : null
                    ]
                );
            }
        }

        // Criar charges para dependentes
        for (const { dependentId, ownerUserId, charges } of DEPENDENT_CHARGES) {
            // Verificar se o dependente existe
            const dependent = await queryRunner.query(
                'SELECT id FROM dependents WHERE id = ? LIMIT 1',
                [dependentId]
            );

            if (dependent.length === 0) {
                console.warn(`Dependent ${dependentId} not found. Skipping charges.`);
                continue;
            }

            // Verificar se o owner existe
            const owner = await queryRunner.query(
                'SELECT id FROM users WHERE id = ? LIMIT 1',
                [ownerUserId]
            );

            if (owner.length === 0) {
                console.warn(`Owner user ${ownerUserId} not found. Skipping charges.`);
                continue;
            }

            for (const charge of charges) {
                const chargeId = require('node:crypto').randomUUID();
                const netAmountCents = charge.amountCents - (charge.discountCents ?? 0);

                await queryRunner.query(
                    `INSERT INTO school_financial_charges (
                        id,
                        school_id,
                        owner_user_id,
                        student_user_id,
                        dependent_id,
                        course_id,
                        course_class_id,
                        charge_type,
                        description,
                        amount_cents,
                        discount_cents,
                        discount_reason,
                        net_amount_cents,
                        due_date,
                        status,
                        paid_at,
                        created_at,
                        updated_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
                    [
                        chargeId,
                        SCHOOL_ID,
                        ownerUserId,
                        null,
                        dependentId,
                        COURSE_ID,
                        COURSE_CLASS_ID,
                        charge.chargeType,
                        charge.description,
                        charge.amountCents,
                        charge.discountCents,
                        charge.discountReason,
                        netAmountCents,
                        charge.dueDate,
                        charge.status,
                        charge.paidAt ? new Date(charge.paidAt) : null
                    ]
                );
            }
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Remover charges de dependentes
        for (const { dependentId } of DEPENDENT_CHARGES) {
            await queryRunner.query(
                'DELETE FROM school_financial_charges WHERE dependent_id = ? AND school_id = ?',
                [dependentId, SCHOOL_ID]
            );
        }

        // Remover charges de estudantes USER
        for (const { studentUserId } of STUDENT_USER_CHARGES) {
            await queryRunner.query(
                'DELETE FROM school_financial_charges WHERE student_user_id = ? AND school_id = ?',
                [studentUserId, SCHOOL_ID]
            );
        }
    }
}

