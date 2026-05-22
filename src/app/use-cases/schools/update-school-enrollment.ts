import { CourseRepository } from '../../../ports/repositories/course.repo';
import { CourseClassRepository } from '../../../ports/repositories/course-class.repo';
import { EnrollmentRepository } from '../../../ports/repositories/enrollment.repo';
import { AppError, ErrorCode } from '../../../shared/errors';
import { equalUuid } from '../../../shared/normalize-uuid';
import { getUtcDay } from '../../../shared/date-utils';
import { presentTuitionExemption } from '../../presenters/tuition-exemption.presenter';
import type {
    UpdateSchoolEnrollmentInput,
    UpdateSchoolEnrollmentOutput
} from '../../types/update-school-enrollment.types';

export class UpdateSchoolEnrollment {
    constructor(
        private readonly courses: CourseRepository,
        private readonly classes: CourseClassRepository,
        private readonly enrollments: EnrollmentRepository
    ) {}

    async exec(input: UpdateSchoolEnrollmentInput): Promise<UpdateSchoolEnrollmentOutput> {
        const schoolId = input.schoolId.trim();
        const courseId = input.courseId.trim();
        const classId = input.classId.trim();
        const enrollmentId = input.enrollmentId.trim();

        if (!schoolId || !courseId || !classId || !enrollmentId) {
            throw AppError.fromCode(ErrorCode.INVALID_IDENTIFIERS);
        }

        const course = await this.courses.findById(courseId);
        if (!course || !equalUuid(course.schoolId, schoolId)) {
            throw AppError.fromCode(ErrorCode.COURSE_NOT_FOUND, { courseId, schoolId });
        }

        const courseClass = await this.classes.findById(classId);
        if (!courseClass || !equalUuid(courseClass.courseId, courseId)) {
            throw AppError.fromCode(ErrorCode.COURSE_CLASS_NOT_FOUND, { classId, courseId });
        }

        const enrollment = await this.enrollments.findById(enrollmentId);
        if (!enrollment || !equalUuid(enrollment.courseClassId, classId)) {
            throw AppError.fromCode(ErrorCode.ENROLLMENT_NOT_FOUND, { enrollmentId, classId });
        }

        if (enrollment.status !== 'ACTIVE') {
            throw AppError.fromCode(ErrorCode.BUSINESS_RULE_VIOLATION, {
                message: 'Somente matrículas ativas podem ser editadas'
            });
        }

        const patch: Parameters<typeof enrollment.applyFinancialSettings>[0] = {};

        if (input.firstMonthlyPaymentDate) {
            const parsed = new Date(input.firstMonthlyPaymentDate);
            if (Number.isNaN(parsed.getTime())) {
                throw AppError.fromCode(ErrorCode.INVALID_DATE, {
                    message: 'firstMonthlyPaymentDate inválida'
                });
            }
            patch.paymentDueDay = getUtcDay(parsed);
        } else if (input.paymentDueDay !== undefined) {
            patch.paymentDueDay = input.paymentDueDay;
        }

        if (input.clearDiscount) {
            patch.discountCents = null;
            patch.discountMonths = null;
        } else {
            if (input.discountCents !== undefined) {
                patch.discountCents = input.discountCents;
            }
            if (input.discountMonths !== undefined) {
                patch.discountMonths = input.discountMonths;
            }
        }

        const addingExemption = input.monthlyTuition === 'EXEMPT';
        const removingExemption = input.removeTuitionExemption === true;

        if (addingExemption && removingExemption) {
            throw AppError.fromCode(ErrorCode.VALIDATION_ERROR, {
                message: 'Não é possível adicionar e remover isenção na mesma requisição'
            });
        }

        if (addingExemption) {
            if (!input.tuitionExemptionType) {
                throw AppError.fromCode(ErrorCode.VALIDATION_ERROR, {
                    message: 'tuitionExemptionType é obrigatório quando monthlyTuition é EXEMPT'
                });
            }
            patch.tuitionExemptionType = input.tuitionExemptionType;
            patch.fullAmountCents = null;
            patch.discountCents = null;
            patch.discountMonths = null;
        } else if (removingExemption) {
            patch.tuitionExemptionType = null;
            const monthlyPrice = course.monthlyPriceCents ?? courseClass.monthlyPriceCents;
            if (!monthlyPrice || monthlyPrice <= 0) {
                throw AppError.fromCode(ErrorCode.VALIDATION_ERROR, {
                    message: 'Curso/turma sem valor de mensalidade para remover isenção'
                });
            }
            patch.fullAmountCents = monthlyPrice;
        } else if (input.tuitionExemptionType !== undefined && !enrollment.isTuitionExempt) {
            throw AppError.fromCode(ErrorCode.VALIDATION_ERROR, {
                message: 'Informe monthlyTuition EXEMPT para aplicar isenção'
            });
        }

        if (
            !addingExemption &&
            !removingExemption &&
            (patch.discountCents !== undefined || patch.discountMonths !== undefined) &&
            enrollment.isTuitionExempt
        ) {
            throw AppError.fromCode(ErrorCode.INVALID_DISCOUNT, {
                message: 'Desconto não se aplica a matrícula isenta'
            });
        }

        try {
            enrollment.applyFinancialSettings(patch);
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Dados financeiros inválidos';
            throw AppError.fromCode(ErrorCode.VALIDATION_ERROR, { message });
        }

        await this.enrollments.save(enrollment);

        const exemption = presentTuitionExemption(enrollment.tuitionExemptionType);

        return {
            id: enrollment.id,
            courseClassId: enrollment.courseClassId,
            status: enrollment.status,
            paymentDueDay: enrollment.paymentDueDay,
            fullAmountCents: enrollment.fullAmountCents,
            discountCents: enrollment.discountCents,
            discountMonths: enrollment.discountMonths,
            monthlyTuition: exemption.monthlyTuition,
            tuitionExemptionType: exemption.tuitionExemptionType,
            updatedAt: enrollment.updatedAt
        };
    }
}
