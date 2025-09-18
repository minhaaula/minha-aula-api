export class Money {
    private constructor(public readonly amount: number, public readonly currency: string) {
        if (!Number.isInteger(amount) || amount <= 0) throw new Error('Invalid amount');
        if (!/^[A-Z]{3}$/.test(currency)) throw new Error('Invalid currency');
    }
    static of(amount: number, currency: string) { return new Money(amount, currency); }
}
