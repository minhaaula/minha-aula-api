export class CourseClass {
    private constructor(
        public readonly id: string,
        public readonly courseId: string,
        public readonly label: string,
        public readonly shift: string | null,
        public readonly capacity: number | null,
        public readonly startsAt: Date | null,
        public readonly endsAt: Date | null,
        public readonly createdAt: Date
    ) {}

    static create(params: {
        id: string;
        courseId: string;
        label: string;
        shift?: string | null;
        capacity?: number | null;
        startsAt?: Date | null;
        endsAt?: Date | null;
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
        const startsAt = params.startsAt ?? null;
        const endsAt = params.endsAt ?? null;
        if (startsAt && Number.isNaN(startsAt.getTime())) throw new Error('Invalid start date');
        if (endsAt && Number.isNaN(endsAt.getTime())) throw new Error('Invalid end date');
        if (startsAt && endsAt && endsAt <= startsAt) throw new Error('End date must be after start date');
        const shift = params.shift?.trim() || null;
        return new CourseClass(
            params.id,
            courseId,
            label,
            shift,
            capacity,
            startsAt,
            endsAt,
            params.createdAt ?? new Date()
        );
    }
}
