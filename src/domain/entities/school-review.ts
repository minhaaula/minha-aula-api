export class SchoolReview {
    private constructor(
        public readonly id: string,
        public readonly schoolId: string,
        public readonly userId: string,
        public readonly rating: number,
        public readonly description: string | null,
        public readonly createdAt: Date,
        public readonly updatedAt: Date
    ) {}

    static create(params: {
        id: string;
        schoolId: string;
        userId: string;
        rating: number;
        description?: string | null;
        createdAt?: Date;
        updatedAt?: Date;
    }) {
        const schoolId = params.schoolId.trim();
        const userId = params.userId.trim();
        if (!schoolId || !userId) {
            throw new Error('School ID and User ID are required');
        }

        const rating = params.rating;
        if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
            throw new Error('Rating must be an integer between 1 and 5');
        }

        const description = params.description?.trim() || null;

        return new SchoolReview(
            params.id,
            schoolId,
            userId,
            rating,
            description,
            params.createdAt ?? new Date(),
            params.updatedAt ?? new Date()
        );
    }
}

