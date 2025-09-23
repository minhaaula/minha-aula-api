export class Email {
    private constructor(private readonly _value: string) {}

    static create(value: string) {
        if (!value) throw new Error('Email is required');
        const normalized = value.trim().toLowerCase();
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

        if (!emailRegex.test(normalized)) throw new Error('Invalid email');
        
        return new Email(normalized);
    }

    get value() {
        return this._value;
    }
}
