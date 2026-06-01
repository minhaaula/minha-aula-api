import { CourseRepository } from '../../../ports/repositories/course.repo';
import { CourseClassRepository } from '../../../ports/repositories/course-class.repo';
import { EnrollmentRepository } from '../../../ports/repositories/enrollment.repo';
import { SchoolRepository } from '../../../ports/repositories/school.repo';
import { AppError, ErrorCode } from '../../../shared/errors';
import { assertNonprofitSchoolAllowsEnrollmentEdit } from '../../../shared/nonprofit-school';
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
        private readonly enrollments: EnrollmentRepository,
        private readonly schools: SchoolRepository
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

        const school = await this.schools.findById(schoolId);
        if (!school) {
            throw AppError.fromCode(ErrorCode.SCHOOL_NOT_FOUND, { schoolId });
        }
        assertNonprofitSchoolAllowsEnrollmentEdit(school.isNonprofitAssociation);

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

        if (input.tuitionExempt === true) {
            if (!input.tuitionExemptionType) {
                throw AppError.fromCode(ErrorCode.VALIDATION_ERROR, {
                    message: 'tuitionExemptionType é obrigatório quando tuitionExempt é true'
                });
            }
            patch.tuitionExemptionType = input.tuitionExemptionType;
            patch.fullAmountCents = null;
            patch.discountCents = null;
            patch.discountMonths = null;
        } else if (input.tuitionExempt === false) {
            patch.tuitionExemptionType = null;
            const monthlyPrice = course.monthlyPriceCents ?? courseClass.monthlyPriceCents;
            if (!monthlyPrice || monthlyPrice <= 0) {
                throw AppError.fromCode(ErrorCode.VALIDATION_ERROR, {
                    message: 'Curso/turma sem valor de mensalidade para voltar a pagante'
                });
            }
            patch.fullAmountCents = monthlyPrice;
        } else if (input.tuitionExemptionType !== undefined && !enrollment.isTuitionExempt) {
            throw AppError.fromCode(ErrorCode.VALIDATION_ERROR, {
                message: 'Informe tuitionExempt true para aplicar isenção'
            });
        }

        if (
            input.tuitionExempt !== true &&
            input.tuitionExempt !== false &&
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
            tuitionExempt: exemption.tuitionExempt,
            tuitionExemptionType: exemption.tuitionExemptionType,
            updatedAt: enrollment.updatedAt
        };
    }
}
