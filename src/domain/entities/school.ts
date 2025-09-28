export class School {
    private constructor(
        public readonly id: string,
        public readonly name: string,
        public readonly createdAt: Date
    ) {}

    static create(params: { id: string; name: string; createdAt?: Date; }) {
        const name = params.name.trim();
        if (!name) throw new Error('School name is required');
        return new School(params.id, name, params.createdAt ?? new Date());
    }
}
