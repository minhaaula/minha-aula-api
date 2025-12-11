import axios, { AxiosInstance, AxiosError } from 'axios';
import { AsaasCreateBoletoPayload, AsaasCreateChargeResponse } from './dto/boleto-charge';
import { AsaasCreateSubAccountPayload, AsaasSubAccountResponse } from './dto/subaccount';
import { AsaasCreateTransferPayload, AsaasCreateTransferResponse } from './dto/transfer';

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

    async createSubAccount(payload: AsaasCreateSubAccountPayload): Promise<AsaasSubAccountResponse> {
        // Validação: verificar se o payload tem os campos obrigatórios antes de enviar
        if (!payload.name || !payload.name.trim()) {
            throw new Error('Asaas subaccount payload validation failed: name is required');
        }
        if (!payload.email || !payload.email.trim()) {
            throw new Error('Asaas subaccount payload validation failed: email is required');
        }
        if (!payload.cpfCnpj || !payload.cpfCnpj.trim()) {
            throw new Error('Asaas subaccount payload validation failed: cpfCnpj is required');
        }
        if (!Number.isFinite(payload.incomeValue) || payload.incomeValue <= 0) {
            throw new Error('Asaas subaccount payload validation failed: incomeValue must be a positive number');
        }

        try {
            const { data } = await this.http.post<AsaasSubAccountResponse>('/accounts', payload);
            
            // Validação: verificar se a resposta da API é válida
            if (!data || typeof data !== 'object') {
                throw new Error('Asaas API returned invalid response: response is not an object');
            }
            if (!data.id || typeof data.id !== 'string' || !data.id.trim()) {
                throw new Error('Asaas API returned invalid response: missing or invalid account ID');
            }
            if (!data.name || typeof data.name !== 'string' || !data.name.trim()) {
                throw new Error('Asaas API returned invalid response: missing or invalid account name');
            }
            if (!data.email || typeof data.email !== 'string' || !data.email.trim()) {
                throw new Error('Asaas API returned invalid response: missing or invalid account email');
            }

            return data;
        } catch (error) {
            throw this.toDomainError(error);
        }
    }

    async createTransfer(accountId: string, payload: AsaasCreateTransferPayload): Promise<AsaasCreateTransferResponse> {
        try {
            const { data } = await this.http.post<AsaasCreateTransferResponse>(`/accounts/${accountId}/transfers`, payload);
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
