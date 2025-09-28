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
        public readonly updatedAt: Date
    ) {}

    static createForUser(params: {
        id: string;
        courseClassId: string;
        ownerUserId: string;
        studentUserId: string;
        status?: EnrollmentStatus;
        enrolledAt?: Date;
        updatedAt?: Date;
    }) {
        const courseClassId = params.courseClassId.trim();
        const ownerUserId = params.ownerUserId.trim();
        const studentUserId = params.studentUserId.trim();
        if (!courseClassId || !ownerUserId || !studentUserId) throw new Error('Invalid enrollment identifiers');
        return new Enrollment(
            params.id,
            courseClassId,
            ownerUserId,
            'USER',
            studentUserId,
            null,
            params.status ?? 'ACTIVE',
            params.enrolledAt ?? new Date(),
            params.updatedAt ?? new Date()
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
    }) {
        const courseClassId = params.courseClassId.trim();
        const ownerUserId = params.ownerUserId.trim();
        const dependentId = params.dependentId.trim();
        if (!courseClassId || !ownerUserId || !dependentId) throw new Error('Invalid enrollment identifiers');
        return new Enrollment(
            params.id,
            courseClassId,
            ownerUserId,
            'DEPENDENT',
            null,
            dependentId,
            params.status ?? 'ACTIVE',
            params.enrolledAt ?? new Date(),
            params.updatedAt ?? new Date()
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
}
