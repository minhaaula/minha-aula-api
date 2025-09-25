export interface AuthTokenPayload {
    sub: string;
    cpf: string;
    fullName: string;
    email: string;
    [key: string]: unknown;
}
