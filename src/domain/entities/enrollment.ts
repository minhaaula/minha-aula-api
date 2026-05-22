import type { TuitionExemptionType } from '../value-objects/tuition-exemption-type';

export type EnrollmentStatus = 'PENDING' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
export type EnrollmentStudentType = 'USER' | 'DEPENDENT';

export type EnrollmentFinancialPatch = {
    paymentDueDay?: number | null;
    fullAmountCents?: number | null;
    tuitionExemptionType?: TuitionExemptionType | null;
    discountCents?: number | null;
    discountMonths?: number | null;
};

export class Enrollment {
    private constructor(
        public readonly id: string,
        public readonly courseClassId: string,
        public readonly ownerUserId: string,
        public readonly studentType: EnrollmentStudentType,
        public readonly studentUserId: string | null,
        public readonly dependentId: string | null,
        private _status: EnrollmentStatus,
        public readonly enrolledAt: Date,
        private _updatedAt: Date,
        private _fullAmountCents: number | null,
        private _paymentDueDay: number | null,
        private _tuitionExemptionType: TuitionExemptionType | null,
        private _discountCents: number | null,
        private _discountMonths: number | null,
        private _currentSchoolStudentLevelId: string | null = null
    ) {}

    static createForUser(params: {
        id: string;
        courseClassId: string;
        ownerUserId: string;
        studentUserId: string;
        status?: EnrollmentStatus;
        enrolledAt?: Date;
        updatedAt?: Date;
        fullAmountCents?: number | null;
        paymentDueDay?: number | null;
        tuitionExemptionType?: TuitionExemptionType | null;
        discountCents?: number | null;
        discountMonths?: number | null;
        currentSchoolStudentLevelId?: string | null;
    }) {
        const courseClassId = params.courseClassId.trim();
        const ownerUserId = params.ownerUserId.trim();
        const studentUserId = params.studentUserId.trim();
        if (!courseClassId || !ownerUserId || !studentUserId) throw new Error('Invalid enrollment identifiers');
        const tuitionExemptionType = Enrollment.normalizeTuitionExemptionType(params.tuitionExemptionType);
        const fullAmountCents = Enrollment.normalizeFullAmountCents(
            tuitionExemptionType ? null : params.fullAmountCents
        );
        const paymentDueDay = Enrollment.normalizePaymentDueDay(params.paymentDueDay);
        const { discountCents, discountMonths } = Enrollment.normalizeDiscount(
            tuitionExemptionType,
            params.discountCents,
            params.discountMonths
        );
        const currentSchoolStudentLevelId = Enrollment.normalizeCurrentLevelId(params.currentSchoolStudentLevelId);
        return new Enrollment(
            params.id,
            courseClassId,
            ownerUserId,
            'USER',
            studentUserId,
            null,
            params.status ?? 'ACTIVE',
            params.enrolledAt ?? new Date(),
            params.updatedAt ?? new Date(),
            fullAmountCents,
            paymentDueDay,
            tuitionExemptionType,
            discountCents,
            discountMonths,
            currentSchoolStudentLevelId
        );
    }

    static createForDependent(params: {
        id: string;
        courseClassId: string;
        ownerUserId: string;
        dependentId: string;
        status?: EnrollmentStatus;
        enrolledAt?: Date;
        updatedAt?: Date;
        fullAmountCents?: number | null;
        paymentDueDay?: number | null;
        tuitionExemptionType?: TuitionExemptionType | null;
        discountCents?: number | null;
        discountMonths?: number | null;
        currentSchoolStudentLevelId?: string | null;
    }) {
        const courseClassId = params.courseClassId.trim();
        const ownerUserId = params.ownerUserId.trim();
        const dependentId = params.dependentId.trim();
        if (!courseClassId || !ownerUserId || !dependentId) throw new Error('Invalid enrollment identifiers');
        const tuitionExemptionType = Enrollment.normalizeTuitionExemptionType(params.tuitionExemptionType);
        const fullAmountCents = Enrollment.normalizeFullAmountCents(
            tuitionExemptionType ? null : params.fullAmountCents
        );
        const paymentDueDay = Enrollment.normalizePaymentDueDay(params.paymentDueDay);
        const { discountCents, discountMonths } = Enrollment.normalizeDiscount(
            tuitionExemptionType,
            params.discountCents,
            params.discountMonths
        );
        const currentSchoolStudentLevelId = Enrollment.normalizeCurrentLevelId(params.currentSchoolStudentLevelId);
        return new Enrollment(
            params.id,
            courseClassId,
            ownerUserId,
            'DEPENDENT',
            null,
            dependentId,
            params.status ?? 'ACTIVE',
            params.enrolledAt ?? new Date(),
            params.updatedAt ?? new Date(),
            fullAmountCents,
            paymentDueDay,
            tuitionExemptionType,
            discountCents,
            discountMonths,
            currentSchoolStudentLevelId
        );
    }

    get status() {
        return this._status;
    }

    get updatedAt() {
        return this._updatedAt;
    }

    complete() {
        if (this._status !== 'ACTIVE') throw new Error('Only active enrollments can be completed');
        this._status = 'COMPLETED';
    }

    cancel() {
        if (this._status === 'CANCELLED') return;
        this._status = 'CANCELLED';
    }

    get fullAmountCents(): number | null {
        return this._fullAmountCents;
    }

    get paymentDueDay(): number {
        return this._paymentDueDay ?? 10;
    }

    get tuitionExemptionType(): TuitionExemptionType | null {
        return this._tuitionExemptionType;
    }

    get isTuitionExempt(): boolean {
        return this._tuitionExemptionType !== null;
    }

    get discountCents(): number | null {
        return this._discountCents;
    }

    get discountMonths(): number | null {
        return this._discountMonths;
    }

    get currentSchoolStudentLevelId(): string | null {
        return this._currentSchoolStudentLevelId;
    }

    applyCurrentSchoolStudentLevel(levelId: string | null): void {
        this._currentSchoolStudentLevelId = Enrollment.normalizeCurrentLevelId(levelId);
    }

    /** Atualiza dia de vencimento, isenção, valor e desconto da matrícula. */
    applyFinancialSettings(patch: EnrollmentFinancialPatch): void {
        let tuitionExemptionType = this._tuitionExemptionType;
        if (patch.tuitionExemptionType !== undefined) {
            tuitionExemptionType = Enrollment.normalizeTuitionExemptionType(patch.tuitionExemptionType);
        }

        let fullAmountCents = this._fullAmountCents;
        if (patch.fullAmountCents !== undefined) {
            fullAmountCents = Enrollment.normalizeFullAmountCents(
                tuitionExemptionType ? null : patch.fullAmountCents
            );
        } else if (tuitionExemptionType && !this._tuitionExemptionType) {
            fullAmountCents = null;
        } else if (!tuitionExemptionType && this._tuitionExemptionType) {
            // isenção removida: fullAmountCents deve ser definido pelo use case antes do patch
        }

        let paymentDueDay = this._paymentDueDay;
        if (patch.paymentDueDay !== undefined) {
            paymentDueDay = Enrollment.normalizePaymentDueDay(patch.paymentDueDay);
        }

        let discountCents = this._discountCents;
        let discountMonths = this._discountMonths;
        if (patch.discountCents !== undefined || patch.discountMonths !== undefined) {
            const normalized = Enrollment.normalizeDiscount(
                tuitionExemptionType,
                patch.discountCents !== undefined ? patch.discountCents : discountCents,
                patch.discountMonths !== undefined ? patch.discountMonths : discountMonths
            );
            discountCents = normalized.discountCents;
            discountMonths = normalized.discountMonths;
        } else if (tuitionExemptionType) {
            discountCents = null;
            discountMonths = null;
        }

        this._tuitionExemptionType = tuitionExemptionType;
        this._fullAmountCents = tuitionExemptionType ? null : fullAmountCents;
        this._paymentDueDay = paymentDueDay;
        this._discountCents = discountCents;
        this._discountMonths = discountMonths;
        this._updatedAt = new Date();
    }

    private static normalizeCurrentLevelId(value: unknown): string | null {
        if (value === undefined || value === null) return null;
        if (typeof value !== 'string') throw new Error('Invalid enrollment current level id');
        const trimmed = value.trim();
        return trimmed.length ? trimmed : null;
    }

    private static normalizeTuitionExemptionType(value: unknown): TuitionExemptionType | null {
        if (value === undefined || value === null) return null;
        if (typeof value !== 'string') throw new Error('Invalid tuition exemption type');
        const trimmed = value.trim();
        if (!trimmed.length) return null;
        const upper = trimmed.toUpperCase();
        const allowed: TuitionExemptionType[] = ['EMPLOYEE', 'RELATIVE', 'SCHOLARSHIP', 'NONPROFIT'];
        if (!allowed.includes(upper as TuitionExemptionType)) {
            throw new Error('Invalid tuition exemption type');
        }
        return upper as TuitionExemptionType;
    }

    private static normalizeFullAmountCents(value: unknown): number | null {
        if (value === undefined || value === null) return null;
        const numeric = typeof value === 'string' ? Number(value) : value;
        if (typeof numeric !== 'number' || Number.isNaN(numeric) || numeric < 0) {
            throw new Error('Enrollment full amount must be a non-negative number');
        }
        return Math.round(numeric);
    }

    private static normalizePaymentDueDay(value: unknown): number | null {
        if (value === undefined || value === null) return null;
        const numeric = typeof value === 'string' ? Number(value) : value;
        if (typeof numeric !== 'number' || Number.isNaN(numeric) || numeric < 1 || numeric > 31) {
            throw new Error('Enrollment payment due day must be between 1 and 31');
        }
        return Math.round(numeric);
    }

    private static normalizeDiscount(
        tuitionExemptionType: TuitionExemptionType | null,
        discountCents: unknown,
        discountMonths: unknown
    ): { discountCents: number | null; discountMonths: number | null } {
        if (tuitionExemptionType) {
            return { discountCents: null, discountMonths: null };
        }

        let cents: number | null = null;
        if (discountCents !== undefined && discountCents !== null) {
            const numeric = typeof discountCents === 'string' ? Number(discountCents) : discountCents;
            if (typeof numeric !== 'number' || Number.isNaN(numeric) || !Number.isInteger(numeric) || numeric < 0) {
                throw new Error('Enrollment discount must be a non-negative integer');
            }
            cents = numeric === 0 ? null : numeric;
        }

        let months: number | null = null;
        if (discountMonths !== undefined && discountMonths !== null) {
            const numeric = typeof discountMonths === 'string' ? Number(discountMonths) : discountMonths;
            if (typeof numeric !== 'number' || Number.isNaN(numeric) || !Number.isInteger(numeric) || numeric < 1) {
                throw new Error('Enrollment discount months must be a positive integer');
            }
            months = numeric;
        }

        if (cents !== null && cents > 0 && months === null) {
            throw new Error('discountMonths is required when discountCents is provided');
        }

        if ((cents === null || cents === 0) && months !== null) {
            return { discountCents: null, discountMonths: null };
        }

        return { discountCents: cents, discountMonths: months };
    }
}
