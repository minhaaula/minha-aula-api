import axios, { AxiosInstance, AxiosError } from 'axios';
import { AsaasCreateBoletoPayload, AsaasCreateChargeResponse } from './dto/boleto-charge';
import { AsaasCreateSubAccountPayload, AsaasSubAccountResponse } from './dto/subaccount';
import { AsaasCreateTransferPayload, AsaasCreateTransferResponse } from './dto/transfer';
import { AsaasCreatePixPayload, AsaasCreatePixResponse } from './dto/pix-charge';

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

    async createPixCharge(payload: AsaasCreatePixPayload): Promise<AsaasCreatePixResponse> {
        try {
            const { data } = await this.http.post<AsaasCreatePixResponse>('/payments', payload);
            
            // Buscar QR Code do PIX após criar a cobrança
            if (data.id) {
                try {
                    const qrCodeResponse = await this.http.get<{ encodedImage: string; payload: string }>(`/payments/${data.id}/pixQrCode`);
                    if (qrCodeResponse.data) {
                        data.pixQrCode = qrCodeResponse.data.encodedImage;
                        data.pixCopiaECola = qrCodeResponse.data.payload;
                    }
                } catch (qrError) {
                    // Se falhar ao buscar QR Code, continuar sem ele
                    console.warn('Failed to fetch PIX QR Code:', qrError);
                }
            }
            
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

    async getAccount(accountId: string): Promise<AsaasSubAccountResponse & { onboardingUrl?: string; kycUrl?: string }> {
        try {
            const { data } = await this.http.get<AsaasSubAccountResponse & { onboardingUrl?: string; kycUrl?: string }>(`/accounts/${accountId}`);
            
            // Validação: verificar se a resposta da API é válida
            if (!data || typeof data !== 'object') {
                throw new Error('Asaas API returned invalid response: response is not an object');
            }
            if (!data.id || typeof data.id !== 'string' || !data.id.trim()) {
                throw new Error('Asaas API returned invalid response: missing or invalid account ID');
            }

            return data;
        } catch (error) {
            throw this.toDomainError(error);
        }
    }

    async getAccountBalance(accountId: string): Promise<{ balance: number; availableBalance: number; blockedBalance?: number }> {
        try {
            // Tentar endpoint específico de balance primeiro (se existir)
            try {
                const { data } = await this.http.get<{ balance: number; availableBalance: number; blockedBalance?: number }>(`/accounts/${accountId}/balance`);
                if (data && typeof data.balance === 'number') {
                    return {
                        balance: data.balance,
                        availableBalance: data.availableBalance ?? data.balance,
                        blockedBalance: data.blockedBalance
                    };
                }
            } catch (balanceError: any) {
                // Se o endpoint de balance não existir (404 ou outro erro), tentar outras abordagens
                if (balanceError?.response?.status !== 404) {
                    console.warn('Erro ao buscar saldo via endpoint /balance:', balanceError.message);
                }
            }

            // Tentar buscar saldo através do endpoint de account (algumas APIs retornam saldo junto com os dados da conta)
            try {
                const accountData = await this.getAccount(accountId);
                
                // Verificar se a resposta do getAccount inclui saldo
                const accountDataAny = accountData as any;
                if (accountDataAny && typeof accountDataAny.balance === 'number') {
                    return {
                        balance: accountDataAny.balance,
                        availableBalance: accountDataAny.availableBalance ?? accountDataAny.balance,
                        blockedBalance: accountDataAny.blockedBalance
                    };
                }
            } catch (accountError) {
                console.warn('Erro ao buscar dados da conta:', accountError);
            }

            // Fallback: retornar 0 se não conseguir buscar (API do Asaas pode não ter endpoint de saldo)
            // O saldo real precisa ser consultado através do extrato ou painel do Asaas
            // Nota: A API do Asaas pode não expor o saldo diretamente via API
            return {
                balance: 0,
                availableBalance: 0,
                blockedBalance: 0
            };
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
