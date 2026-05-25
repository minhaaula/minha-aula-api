import { z } from 'zod';
import { adminUpdateStudentSchema } from './admin-update-student-schemas';

/**
 * PATCH /schools/students/:studentId — apenas dados pessoais (sem OTP).
 * Matrícula/mensalidade: PATCH /schools/courses/:courseId/classes/:classId/enrollments/:enrollmentId
 */
export const patchSchoolStudentSchema = adminUpdateStudentSchema.strict({
    message:
        'Campos de matrícula não são aceitos nesta rota. Use PATCH .../courses/{courseId}/classes/{classId}/enrollments/{enrollmentId}'
});

export type PatchSchoolStudentBody = z.infer<typeof patchSchoolStudentSchema>;
