import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { PasswordHasherPort } from '../../ports/providers/password-hasher.port';

export class ScryptPasswordHasher implements PasswordHasherPort {
    async hash(plain: string): Promise<string> {
        if (!plain) throw new Error('Password is required');
        const salt = randomBytes(16).toString('hex');
        const derived = scryptSync(plain, salt, 64).toString('hex');
        return `${salt}:${derived}`;
    }

    async compare(plain: string, hashed: string): Promise<boolean> {
        if (!hashed) return false;
        const [salt, key] = hashed.split(':');
        if (!salt || !key) return false;
        const derived = scryptSync(plain, salt, 64).toString('hex');
        try {
            return timingSafeEqual(Buffer.from(key, 'hex'), Buffer.from(derived, 'hex'));
        } catch {
            return false;
        }
    }
}
