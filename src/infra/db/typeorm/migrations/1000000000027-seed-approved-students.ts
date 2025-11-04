import { MigrationInterface, QueryRunner } from 'typeorm';

// ID da turma do seed anterior
const COURSE_CLASS_ID = 'e6c5f4d9-2d5f-4f22-9f4a-0d3a50ba3b2c';

// IDs dos estudantes do seed-extra-demo-students que precisam de matrícula
const STUDENT_USER_IDS = [
    '2f5a90d5-063f-4c0f-9c8b-9361cfe0d061', // Gabriela Martins
    '5f8a0b3e-9f79-4d54-85e4-cb8468e5c5d2', // Thiago Moreira
    'e6a4f1f9-9428-4d8a-a246-47eb1fa4e821'  // Elisa Castro
] as const;

// IDs dos dependentes que precisam de matrícula
// Com seus respectivos owners (pais/responsáveis)
const DEPENDENT_ENROLLMENTS = [
    {
        dependentId: '4c9c1c88-089e-4f60-9e97-4588deccadf4', // Rafael Almeida
        ownerUserId: 'b4e6c8d2-7f3a-4d9b-9e1c-2f4a6b8c0d12'  // Luiza Almeida (mãe)
    },
    {
        dependentId: '6d2fc1a2-9731-4800-8f0d-34374d7d8e9a', // Camila Nogueira
        ownerUserId: 'd315e7fa-8c9b-4a2d-9e1f-0a1b2c3d4e5f'  // Pedro Nogueira (pai)
    }
] as const;

export class SeedApprovedStudents1000000000027 implements MigrationInterface {
    name = 'SeedApprovedStudents1000000000027';

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Verificar se a turma existe
        const courseClass = await queryRunner.query(
            'SELECT id FROM course_classes WHERE id = ? LIMIT 1',
            [COURSE_CLASS_ID]
        );

        if (courseClass.length === 0) {
            console.warn(`Course class ${COURSE_CLASS_ID} not found. Skipping enrollment creation.`);
            return;
        }

        // Criar matrículas para estudantes (USER)
        for (const studentUserId of STUDENT_USER_IDS) {
            // Verificar se o usuário existe
            const user = await queryRunner.query(
                'SELECT id FROM users WHERE id = ? AND persona = ? LIMIT 1',
                [studentUserId, 'STUDENT']
            );

            if (user.length === 0) {
                console.warn(`Student user ${studentUserId} not found. Skipping enrollment.`);
                continue;
            }

            // Verificar se já existe matrícula
            const existingEnrollment = await queryRunner.query(
                'SELECT id FROM enrollments WHERE course_class_id = ? AND student_user_id = ? LIMIT 1',
                [COURSE_CLASS_ID, studentUserId]
            );

            if (existingEnrollment.length === 0) {
                const enrollmentId = require('node:crypto').randomUUID();
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
                        enrollmentId,
                        COURSE_CLASS_ID,
                        studentUserId, // owner é o próprio estudante
                        'USER',
                        studentUserId,
                        null,
                        'ACTIVE'
                    ]
                );
            }
        }

        // Criar matrículas para dependentes
        for (const { dependentId, ownerUserId } of DEPENDENT_ENROLLMENTS) {
            // Verificar se o dependente existe
            const dependent = await queryRunner.query(
                'SELECT id FROM dependents WHERE id = ? LIMIT 1',
                [dependentId]
            );

            if (dependent.length === 0) {
                console.warn(`Dependent ${dependentId} not found. Skipping enrollment.`);
                continue;
            }

            // Verificar se o owner existe
            const owner = await queryRunner.query(
                'SELECT id FROM users WHERE id = ? LIMIT 1',
                [ownerUserId]
            );

            if (owner.length === 0) {
                console.warn(`Owner user ${ownerUserId} not found. Skipping enrollment.`);
                continue;
            }

            // Verificar se já existe matrícula
            const existingEnrollment = await queryRunner.query(
                'SELECT id FROM enrollments WHERE course_class_id = ? AND dependent_id = ? LIMIT 1',
                [COURSE_CLASS_ID, dependentId]
            );

            if (existingEnrollment.length === 0) {
                const enrollmentId = require('node:crypto').randomUUID();
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
                        enrollmentId,
                        COURSE_CLASS_ID,
                        ownerUserId,
                        'DEPENDENT',
                        null,
                        dependentId,
                        'ACTIVE'
                    ]
                );
            }
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Remover matrículas de dependentes
        for (const { dependentId } of DEPENDENT_ENROLLMENTS) {
            await queryRunner.query(
                'DELETE FROM enrollments WHERE course_class_id = ? AND dependent_id = ?',
                [COURSE_CLASS_ID, dependentId]
            );
        }

        // Remover matrículas de estudantes
        for (const studentUserId of STUDENT_USER_IDS) {
            await queryRunner.query(
                'DELETE FROM enrollments WHERE course_class_id = ? AND student_user_id = ?',
                [COURSE_CLASS_ID, studentUserId]
            );
        }
    }
}

