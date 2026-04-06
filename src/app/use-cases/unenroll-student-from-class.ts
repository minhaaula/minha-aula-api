import { CourseRepository } from '../../ports/repositories/course.repo';
import { CourseClassRepository } from '../../ports/repositories/course-class.repo';
import { EnrollmentRepository } from '../../ports/repositories/enrollment.repo';
import { equalUuid } from '../../shared/normalize-uuid';
import { AppError, ErrorCode } from '../../shared/errors';
import type { UnenrollStudentFromClassInput, UnenrollStudentFromClassOutput } from '../types/enrollment.types';

/**
 * Desmatricula o aluno da turma (matrícula → CANCELLED).
 * Não altera `school_financial_charges`: boletos/cobranças abertas ou atrasadas permanecem.
 */
export class UnenrollStudentFromClass {
    constructor(
        private readonly courses: CourseRepository,
        private readonly classes: CourseClassRepository,
        private readonly enrollments: EnrollmentRepository
    ) {}

    async exec(input: UnenrollStudentFromClassInput): Promise<UnenrollStudentFromClassOutput> {
        const schoolId = input.schoolId.trim();
        const courseId = input.courseId.trim();
        const classId = input.classId.trim();
        const enrollmentId = input.enrollmentId.trim();

        if (!schoolId || !courseId || !classId || !enrollmentId) {
            throw AppError.fromCode(ErrorCode.INVALID_IDENTIFIERS, {
                message: 'schoolId, courseId, classId e enrollmentId são obrigatórios'
            });
        }

        const course = await this.courses.findById(courseId);
        if (!course || !course.isActive || !equalUuid(course.schoolId, schoolId)) {
            throw AppError.fromCode(ErrorCode.COURSE_NOT_FOUND, { courseId, schoolId });
        }

        const courseClass = await this.classes.findById(classId);
        if (!courseClass || !courseClass.isActive || !equalUuid(courseClass.courseId, courseId)) {
            throw AppError.fromCode(ErrorCode.COURSE_CLASS_NOT_FOUND, { classId, courseId });
        }

        const enrollment = await this.enrollments.findById(enrollmentId);
        if (!enrollment || !equalUuid(enrollment.courseClassId, classId)) {
            throw AppError.fromCode(ErrorCode.ENROLLMENT_NOT_FOUND, { enrollmentId, classId });
        }

        if (enrollment.status === 'CANCELLED' || enrollment.status === 'COMPLETED') {
            throw AppError.validation('Matrícula já está cancelada ou encerrada.', {
                enrollmentId,
                status: enrollment.status
            });
        }

        if (enrollment.status !== 'ACTIVE' && enrollment.status !== 'PENDING') {
            throw AppError.validation('Somente matrículas ativas ou pendentes podem ser desfeitas.', {
                enrollmentId,
                status: enrollment.status
            });
        }

        enrollment.cancel();
        await this.enrollments.save(enrollment);

        return {
            enrollmentId: enrollment.id,
            status: 'CANCELLED'
        };
    }
}
