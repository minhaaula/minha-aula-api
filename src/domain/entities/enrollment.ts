import type { TuitionExemptionType } from '../value-objects/tuition-exemption-type';

export type EnrollmentStatus = 'PENDING' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
export type EnrollmentStudentType = 'USER' | 'DEPENDENT';

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
        public readonly updatedAt: Date,
        private readonly _fullAmountCents: number | null,
        private readonly _paymentDueDay: number | null,
        private readonly _tuitionExemptionType: TuitionExemptionType | null,
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
            currentSchoolStudentLevelId
        );
    }

    get status() {
        return this._status;
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
        return this._paymentDueDay ?? 10; // Padrão: dia 10
    }

    get tuitionExemptionType(): TuitionExemptionType | null {
        return this._tuitionExemptionType;
    }

    get isTuitionExempt(): boolean {
        return this._tuitionExemptionType !== null;
    }

    get currentSchoolStudentLevelId(): string | null {
        return this._currentSchoolStudentLevelId;
    }

    /** Atualiza o ponteiro do nível atual desta matrícula (uso em promoções). */
    applyCurrentSchoolStudentLevel(levelId: string | null): void {
        this._currentSchoolStudentLevelId = Enrollment.normalizeCurrentLevelId(levelId);
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
}
