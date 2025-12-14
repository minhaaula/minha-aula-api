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
        private readonly _paymentDueDay: number | null
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
    }) {
        const courseClassId = params.courseClassId.trim();
        const ownerUserId = params.ownerUserId.trim();
        const studentUserId = params.studentUserId.trim();
        if (!courseClassId || !ownerUserId || !studentUserId) throw new Error('Invalid enrollment identifiers');
        const fullAmountCents = Enrollment.normalizeFullAmountCents(params.fullAmountCents);
        const paymentDueDay = Enrollment.normalizePaymentDueDay(params.paymentDueDay);
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
            paymentDueDay
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
    }) {
        const courseClassId = params.courseClassId.trim();
        const ownerUserId = params.ownerUserId.trim();
        const dependentId = params.dependentId.trim();
        if (!courseClassId || !ownerUserId || !dependentId) throw new Error('Invalid enrollment identifiers');
        const fullAmountCents = Enrollment.normalizeFullAmountCents(params.fullAmountCents);
        const paymentDueDay = Enrollment.normalizePaymentDueDay(params.paymentDueDay);
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
            paymentDueDay
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
