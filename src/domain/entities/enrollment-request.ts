export type EnrollmentRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';

export class EnrollmentRequest {
    private constructor(
        public readonly id: string,
        public readonly schoolId: string,
        public readonly courseClassId: string,
        public readonly requestedForUserId: string,
        public readonly requestedForDependentId: string | null,
        private _status: EnrollmentRequestStatus,
        private _decidedAt: Date | null,
        private _decidedByUserId: string | null,
        private _notes: string | null,
        private _discountCents: number | null,
        private _discountMonths: number | null,
        private _enrollmentFeeCents: number | null,
        private _enrollmentFeeDueDate: Date | null,
        private _firstMonthlyPaymentDate: Date,
        private _enrollmentId: string | null,
        public readonly createdAt: Date
    ) {}

    static create(params: {
        id: string;
        schoolId: string;
        courseClassId: string;
        requestedForUserId: string;
        requestedForDependentId?: string | null;
        notes?: string | null;
        discountCents?: number | null;
        discountMonths?: number | null;
        enrollmentFeeCents?: number | null;
        enrollmentFeeDueDate?: Date | null;
        firstMonthlyPaymentDate: Date;
        createdAt?: Date;
    }) {
        const schoolId = params.schoolId.trim();
        const courseClassId = params.courseClassId.trim();
        const requestedForUserId = params.requestedForUserId.trim();
        if (!schoolId || !courseClassId || !requestedForUserId) {
            throw new Error('Invalid enrollment request identifiers');
        }
        const requestedForDependentId = params.requestedForDependentId?.trim() || null;
        const notes = params.notes?.trim() || null;
        const discountCents = params.discountCents ?? null;
        if (discountCents !== null) {
            if (!Number.isInteger(discountCents) || discountCents < 0) {
                throw new Error('Enrollment request discount must be a non-negative integer');
            }
        }
        const discountMonths = params.discountMonths ?? null;
        if (discountMonths !== null) {
            if (!Number.isInteger(discountMonths) || discountMonths < 1) {
                throw new Error('Enrollment request discount months must be a positive integer');
            }
        }
        // Validar que se há desconto, deve ter discountMonths
        if (discountCents !== null && discountCents > 0 && discountMonths === null) {
            throw new Error('discountMonths is required when discount is provided');
        }
        const enrollmentFeeCents = params.enrollmentFeeCents ?? null;
        if (enrollmentFeeCents !== null) {
            if (!Number.isInteger(enrollmentFeeCents) || enrollmentFeeCents < 0) {
                throw new Error('Enrollment request fee must be a non-negative integer');
            }
        }
        let enrollmentFeeDueDate: Date | null = null;
        if (params.enrollmentFeeDueDate) {
            const dueDate = new Date(params.enrollmentFeeDueDate);
            if (Number.isNaN(dueDate.getTime())) {
                throw new Error('Invalid enrollment fee due date');
            }
            enrollmentFeeDueDate = new Date(Date.UTC(dueDate.getUTCFullYear(), dueDate.getUTCMonth(), dueDate.getUTCDate()));
            if (enrollmentFeeCents === null) {
                throw new Error('Enrollment fee due date requires a fee amount');
            }
        }
        const firstMonthlyPaymentDate = new Date(params.firstMonthlyPaymentDate);
        if (Number.isNaN(firstMonthlyPaymentDate.getTime())) {
            throw new Error('Invalid first monthly payment date');
        }
        const normalizedFirstMonthlyPaymentDate = new Date(
            Date.UTC(
                firstMonthlyPaymentDate.getUTCFullYear(),
                firstMonthlyPaymentDate.getUTCMonth(),
                firstMonthlyPaymentDate.getUTCDate()
            )
        );

        return new EnrollmentRequest(
            params.id,
            schoolId,
            courseClassId,
            requestedForUserId,
            requestedForDependentId,
            'PENDING',
            null,
            null,
            notes,
            discountCents,
            discountMonths,
            enrollmentFeeCents,
            enrollmentFeeDueDate,
            normalizedFirstMonthlyPaymentDate,
            null,
            params.createdAt ?? new Date()
        );
    }

    get status() {
        return this._status;
    }

    get decidedAt() {
        return this._decidedAt;
    }

    get decidedByUserId() {
        return this._decidedByUserId;
    }

    get notes() {
        return this._notes;
    }

    get discountCents() {
        return this._discountCents;
    }

    get discountMonths() {
        return this._discountMonths;
    }

    get enrollmentFeeCents() {
        return this._enrollmentFeeCents;
    }

    get enrollmentFeeDueDate() {
        return this._enrollmentFeeDueDate;
    }

    get firstMonthlyPaymentDate() {
        return this._firstMonthlyPaymentDate;
    }

    get enrollmentId() {
        return this._enrollmentId;
    }

    approve(params: { decidedByUserId: string; enrollmentId: string; notes?: string | null; }) {
        if (this._status !== 'PENDING') throw new Error('Enrollment request already decided');
        const decidedByUserId = params.decidedByUserId.trim();
        const enrollmentId = params.enrollmentId.trim();
        if (!decidedByUserId || !enrollmentId) throw new Error('Invalid approval data');
        this._status = 'APPROVED';
        this._decidedAt = new Date();
        this._decidedByUserId = decidedByUserId;
        this._enrollmentId = enrollmentId;
        this._notes = params.notes?.trim() || null;
    }

    reject(params: { decidedByUserId: string; notes?: string | null; }) {
        if (this._status !== 'PENDING') throw new Error('Enrollment request already decided');
        const decidedByUserId = params.decidedByUserId.trim();
        if (!decidedByUserId) throw new Error('Invalid rejection data');
        this._status = 'REJECTED';
        this._decidedAt = new Date();
        this._decidedByUserId = decidedByUserId;
        this._notes = params.notes?.trim() || null;
    }

    cancel(params: { decidedByUserId: string; notes?: string | null; }) {
        if (this._status !== 'PENDING') throw new Error('Enrollment request already decided');
        const decidedByUserId = params.decidedByUserId.trim();
        if (!decidedByUserId) throw new Error('Invalid cancellation data');
        this._status = 'CANCELLED';
        this._decidedAt = new Date();
        this._decidedByUserId = decidedByUserId;
        this._notes = params.notes?.trim() || null;
    }
}
