import { createHmac, timingSafeEqual } from 'node:crypto';
import { TokenProviderPort } from 'src/ports/providers/token-provider.port';

const nowSeconds = () => Math.floor(Date.now() / 1000);
const base64UrlEncode = (data: string) => Buffer.from(data).toString('base64url');
const base64UrlDecode = (data: string) => Buffer.from(data, 'base64url').toString('utf8');

export class HmacTokenProvider implements TokenProviderPort {
    constructor(private readonly secret: string) {
        if (!secret) throw new Error('AUTH_TOKEN_SECRET is required');
    }

    async sign(payload: Record<string, unknown>, opts?: { expiresIn?: number }): Promise<string> {
        const enhanced = { ...payload } as Record<string, unknown> & { exp?: number };
        if (opts?.expiresIn) {
            enhanced.exp = nowSeconds() + opts.expiresIn;
        }
        const data = base64UrlEncode(JSON.stringify(enhanced));
        const signature = createHmac('sha256', this.secret).update(data).digest('base64url');
        return `${data}.${signature}`;
    }

    async verify<T = Record<string, unknown>>(token: string): Promise<T> {
        const [data, signature] = token.split('.');
        if (!data || !signature) throw new Error('Invalid token');
        const expected = createHmac('sha256', this.secret).update(data).digest();
        const received = Buffer.from(signature, 'base64url');
        if (expected.length !== received.length || !timingSafeEqual(expected, received)) {
            throw new Error('Invalid token');
        }
        const payload = JSON.parse(base64UrlDecode(data)) as { exp?: number } & Record<string, unknown>;
        if (payload.exp && payload.exp < nowSeconds()) throw new Error('Token expired');
        return payload as T;
    }
}
