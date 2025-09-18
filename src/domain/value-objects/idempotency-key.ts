export class IdempotencyKey {
    private constructor(public readonly value: string) {
        if (!value || value.length < 8) throw new Error('Invalid IdempotencyKey');
    }

    static of(v: string) { return new IdempotencyKey(v); }
}
