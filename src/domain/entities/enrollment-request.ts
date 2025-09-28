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
