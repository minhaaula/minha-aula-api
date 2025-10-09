export type ClassSessionStatus = 'SCHEDULED' | 'CANCELLED';

export class ClassSession {
    private _status: ClassSessionStatus;
    private _startsAt: Date;
    private _endsAt: Date;
    private _location: string | null;
    private _notes: string | null;
    private readonly _createdAt: Date;
    private _updatedAt: Date;

    private constructor(
        public readonly id: string,
        public readonly schoolId: string,
        public readonly courseClassId: string,
        startsAt: Date,
        endsAt: Date,
        status: ClassSessionStatus,
        location: string | null,
        notes: string | null,
        createdAt: Date,
        updatedAt: Date
    ) {
        this._startsAt = new Date(startsAt);
        this._endsAt = new Date(endsAt);
        this._status = status;
        this._location = location;
        this._notes = notes;
        this._createdAt = new Date(createdAt);
        this._updatedAt = new Date(updatedAt);
    }

    static create(params: {
        id: string;
        schoolId: string;
        courseClassId: string;
        startsAt: Date;
        endsAt: Date;
        status?: ClassSessionStatus;
        location?: string | null;
        notes?: string | null;
        createdAt?: Date;
        updatedAt?: Date;
    }) {
        const id = params.id.trim();
        if (!id) throw new Error('Class session id is required');
        const schoolId = params.schoolId.trim();
        if (!schoolId) throw new Error('Class session school id is required');
        const courseClassId = params.courseClassId.trim();
        if (!courseClassId) throw new Error('Class session class id is required');

        const startsAt = new Date(params.startsAt);
        const endsAt = new Date(params.endsAt);
        if (Number.isNaN(startsAt.getTime())) throw new Error('Class session start date is invalid');
        if (Number.isNaN(endsAt.getTime())) throw new Error('Class session end date is invalid');
        if (endsAt <= startsAt) throw new Error('Class session end must be after start');

        const status = params.status ?? 'SCHEDULED';
        if (status !== 'SCHEDULED' && status !== 'CANCELLED') {
            throw new Error('Invalid class session status');
        }

        const location = params.location?.trim() || null;
        const notes = params.notes?.trim() || null;

        const createdAt = params.createdAt ? new Date(params.createdAt) : new Date();
        const updatedAt = params.updatedAt ? new Date(params.updatedAt) : new Date();

        return new ClassSession(
            id,
            schoolId,
            courseClassId,
            startsAt,
            endsAt,
            status,
            location,
            notes,
            createdAt,
            updatedAt
        );
    }

    get status(): ClassSessionStatus {
        return this._status;
    }

    get startsAt(): Date {
        return new Date(this._startsAt);
    }

    get endsAt(): Date {
        return new Date(this._endsAt);
    }

    get location(): string | null {
        return this._location;
    }

    get notes(): string | null {
        return this._notes;
    }

    get createdAt(): Date {
        return new Date(this._createdAt);
    }

    get updatedAt(): Date {
        return new Date(this._updatedAt);
    }

    reschedule(params: { startsAt: Date; endsAt: Date }) {
        const startsAt = new Date(params.startsAt);
        const endsAt = new Date(params.endsAt);
        if (Number.isNaN(startsAt.getTime())) throw new Error('Class session start date is invalid');
        if (Number.isNaN(endsAt.getTime())) throw new Error('Class session end date is invalid');
        if (endsAt <= startsAt) throw new Error('Class session end must be after start');
        this._startsAt = startsAt;
        this._endsAt = endsAt;
        this.touch();
    }

    updateDetails(params: { location?: string | null; notes?: string | null }) {
        if ('location' in params) {
            this._location = params.location?.trim() || null;
        }
        if ('notes' in params) {
            this._notes = params.notes?.trim() || null;
        }
        this.touch();
    }

    cancel() {
        if (this._status === 'CANCELLED') return;
        this._status = 'CANCELLED';
        this.touch();
    }

    private touch() {
        this._updatedAt = new Date();
    }
}
