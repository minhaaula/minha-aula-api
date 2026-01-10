const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

export type CourseClassScheduleEntry = {
    day: string;
    start: string;
    end: string;
};

export class CourseClass {
    private constructor(
        public readonly id: string,
        public readonly courseId: string,
        public readonly label: string,
        public readonly schedule: ReadonlyArray<CourseClassScheduleEntry>,
        public readonly capacity: number | null,
        private readonly _monthlyPriceCents: number | null,
        private _isActive: boolean,
        public readonly createdAt: Date
    ) {}

    static create(params: {
        id: string;
        courseId: string;
        label: string;
        schedule: CourseClassScheduleEntry[];
        capacity?: number | null;
        monthlyPriceCents?: number | null;
        isActive?: boolean;
        createdAt?: Date;
    }) {
        const label = params.label.trim();
        if (!label) throw new Error('Class label is required');
        const courseId = params.courseId.trim();
        if (!courseId) throw new Error('Course id is required');
        const capacity = params.capacity ?? null;
        if (capacity !== null && (capacity <= 0 || !Number.isInteger(capacity))) {
            throw new Error('Class capacity must be a positive integer');
        }

        const monthlyPriceCents = CourseClass.normalizeMonthlyPriceCents(params.monthlyPriceCents);

        const schedule = Array.isArray(params.schedule) ? params.schedule : [];
        if (!schedule.length) throw new Error('Class schedule must contain at least one entry');

        const normalizedSchedule = schedule.map((entry, index) => {
            const day = entry.day?.trim();
            const start = entry.start?.trim();
            const end = entry.end?.trim();

            if (!day) throw new Error(`Class schedule entry #${index + 1} day is required`);
            if (!start || !TIME_PATTERN.test(start)) {
                throw new Error(`Class schedule entry #${index + 1} start time is invalid`);
            }
            if (!end || !TIME_PATTERN.test(end)) {
                throw new Error(`Class schedule entry #${index + 1} end time is invalid`);
            }

            const [startHours, startMinutes] = start.split(':').map((value) => Number(value));
            const [endHours, endMinutes] = end.split(':').map((value) => Number(value));
            const startTotalMinutes = startHours * 60 + startMinutes;
            const endTotalMinutes = endHours * 60 + endMinutes;

            if (endTotalMinutes <= startTotalMinutes) {
                throw new Error(`Class schedule entry #${index + 1} end time must be after start time`);
            }

            return Object.freeze({
                day,
                start,
                end
            });
        });

        return new CourseClass(
            params.id,
            courseId,
            label,
            Object.freeze(normalizedSchedule.slice()),
            capacity,
            monthlyPriceCents,
            params.isActive ?? true,
            params.createdAt ?? new Date()
        );
    }

    private static normalizeMonthlyPriceCents(value?: number | null): number | null {
        if (value === undefined || value === null) {
            return null;
        }
        if (!Number.isInteger(value) || value < 0) {
            throw new Error('Monthly price must be a non-negative integer (in cents)');
        }
        return value;
    }

    get monthlyPriceCents(): number | null {
        return this._monthlyPriceCents;
    }

    get isActive() {
        return this._isActive;
    }

    deactivate() {
        this._isActive = false;
    }

    activate() {
        this._isActive = true;
    }
}
