import { Email } from '../value-objects/email';

export class User {
    private constructor(
        public readonly id: string,
        public readonly email: Email,
        private _passwordHash: string,
        public readonly createdAt: Date
    ) {}

    static create(params: { id: string; email: Email; passwordHash: string; createdAt?: Date; }) {
        return new User(params.id, params.email, params.passwordHash, params.createdAt ?? new Date());
    }

    get passwordHash() {
        return this._passwordHash;
    }

    setPasswordHash(hash: string) {
        this._passwordHash = hash;
    }
}
