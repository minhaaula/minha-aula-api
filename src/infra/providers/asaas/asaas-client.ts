import axios, { AxiosInstance, AxiosError } from 'axios';
import { AsaasCreateBoletoPayload, AsaasCreateChargeResponse } from './dto/boleto-charge';

export class AsaasClient {
    private http: AxiosInstance;
    constructor(apiKey: string, baseUrl = process.env.ASAAS_BASE_URL || 'https://www.asaas.com/api/v3') {
        this.http = axios.create({
            baseURL: baseUrl,
            headers: {
                access_token: apiKey,
                'Content-Type': 'application/json'
            }
        });
    }

    async createBoletoCharge(payload: AsaasCreateBoletoPayload): Promise<AsaasCreateChargeResponse> {
        try {
            const { data } = await this.http.post<AsaasCreateChargeResponse>('/payments', payload);
            return data;
        } catch (error) {
            throw this.toDomainError(error);
        }
    }

    private toDomainError(error: unknown): Error {
        if (axios.isAxiosError(error)) {
            const axiosError = error as AxiosError<any>;
            const status = axiosError.response?.status;
            const message = axiosError.response?.data?.errors?.map((err: any) => err.description ?? err.message).join('; ');
            const reason = message || axiosError.response?.statusText || axiosError.message;
            return new Error(`Asaas request failed${status ? ` (status ${status})` : ''}: ${reason}`);
        }
        return error instanceof Error ? error : new Error('Unknown Asaas client error');
    }
}
