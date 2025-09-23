export interface TokenProviderPort {
    sign(payload: Record<string, unknown>, opts?: { expiresIn?: number }): Promise<string>;
    verify<T = Record<string, unknown>>(token: string): Promise<T>;
}
