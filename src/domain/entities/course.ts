export class Course {
    private constructor(
        public readonly id: string,
        public readonly schoolId: string,
        public readonly name: string,
        public readonly description: string | null,
        private _isActive: boolean,
        public readonly createdAt: Date
    ) {}

    static create(params: {
        id: string;
        schoolId: string;
        name: string;
        description?: string | null;
        isActive?: boolean;
        createdAt?: Date;
    }) {
        const name = params.name.trim();
        if (!name) throw new Error('Course name is required');
        const schoolId = params.schoolId.trim();
        if (!schoolId) throw new Error('School id is required');
        const description = params.description?.trim() ?? null;
        return new Course(
            params.id,
            schoolId,
            name,
            description,
            params.isActive ?? true,
            params.createdAt ?? new Date()
        );
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
