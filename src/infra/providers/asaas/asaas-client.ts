import axios, { AxiosInstance, AxiosError } from 'axios';
import FormData from 'form-data';
import { log } from '../../../shared/logger';
import { AsaasCreateBoletoPayload, AsaasCreateChargeResponse } from './dto/boleto-charge';
import { AsaasCreateSubAccountPayload, AsaasSubAccountResponse } from './dto/subaccount';
import { AsaasCreateTransferPayload, AsaasCreateTransferResponse } from './dto/transfer';
import { AsaasCreatePixPayload, AsaasCreatePixResponse } from './dto/pix-charge';

/** Extrai identificador de conta bancária em respostas POST /v3/bankAccounts (formato varia entre versões/ambientes Asaas). */
function pickAsaasBankAccountId(data: Record<string, unknown>): string | null {
    const coerce = (v: unknown): string | null => {
        if (typeof v === 'string' && v.trim()) return v.trim();
        if (typeof v === 'number' && Number.isFinite(v)) return String(v);
        return null;
    };

    const tryObject = (obj: Record<string, unknown> | null | undefined): string | null => {
        if (!obj || typeof obj !== 'object') return null;
        return coerce(obj.id);
    };

    const fromTop = tryObject(data);
    if (fromTop) return fromTop;

    const nested = data.bankAccount;
    if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
        const fromNested = tryObject(nested as Record<string, unknown>);
        if (fromNested) return fromNested;
    }

    const inner = data.data;
    if (inner && typeof inner === 'object') {
        if (!Array.isArray(inner)) {
            const fromInner = tryObject(inner as Record<string, unknown>);
            if (fromInner) return fromInner;
        } else if (inner.length > 0 && typeof inner[0] === 'object' && inner[0] !== null) {
            const fromFirst = tryObject(inner[0] as Record<string, unknown>);
            if (fromFirst) return fromFirst;
        }
    }

    return null;
}

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

    /**
     * Atualiza cadastro do cliente (ex.: desativar todas as notificações automáticas do Asaas para o pagador).
     * PUT /v3/customers/{id}
     */
    async updateCustomer(customerId: string, payload: { notificationDisabled: boolean }): Promise<void> {
        const id = customerId?.trim();
        if (!id) throw new Error('customerId is required');
        try {
            await this.http.put(`/customers/${encodeURIComponent(id)}`, payload);
        } catch (error) {
            throw this.toDomainError(error);
        }
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

    /** GET /v3/payments/{id}/pixQrCode */
    async getPixQrCode(paymentId: string): Promise<{ encodedImage: string; payload: string }> {
        const id = paymentId?.trim();
        if (!id) throw new Error('paymentId is required');
        try {
            const { data } = await this.http.get<{ encodedImage: string; payload: string }>(`/payments/${encodeURIComponent(id)}/pixQrCode`);
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

    /**
     * Lista subcontas filtrando por e-mail (GET /v3/accounts?email=).
     * Usado quando POST /v3/accounts falha com "email já em uso" — permite recuperar a conta já existente.
     */
    async listAccountsByEmail(email: string): Promise<AsaasSubAccountResponse[]> {
        const normalized = email?.trim();
        if (!normalized) return [];
        try {
            const { data } = await this.http.get<{ data?: AsaasSubAccountResponse[] } | AsaasSubAccountResponse[]>(
                `/accounts`,
                { params: { email: normalized, limit: 10 } }
            );
            if (Array.isArray(data)) return data;
            if (data && typeof data === 'object' && Array.isArray(data.data)) return data.data;
            return [];
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

    async getPayment(paymentId: string): Promise<{
        id: string;
        status?: string;
        transactionReceiptUrl?: string | null;
        paymentDate?: string | null;
        confirmedDate?: string | null;
        receivedDate?: string | null;
    }> {
        try {
            const { data } = await this.http.get<{
                id: string;
                status?: string;
                transactionReceiptUrl?: string | null;
                paymentDate?: string | null;
                confirmedDate?: string | null;
                receivedDate?: string | null;
            }>(`/payments/${paymentId}`);

            if (!data || typeof data !== 'object') {
                console.error('[AsaasClient.getPayment] Invalid response type from Asaas', {
                    paymentId,
                    responseType: typeof data
                });

                return {
                    id: paymentId,
                    status: undefined,
                    transactionReceiptUrl: null,
                    paymentDate: null,
                    confirmedDate: null,
                    receivedDate: null
                };
            }

            if (!('id' in data) || typeof (data as any).id !== 'string' || !(data as any).id.trim()) {
                console.error('[AsaasClient.getPayment] Missing or invalid payment ID in Asaas response', {
                    paymentId,
                    responseKeys: Object.keys(data as any)
                });
                return {
                    id: paymentId,
                    status: (data as any).status,
                    transactionReceiptUrl: (data as any).transactionReceiptUrl ?? null,
                    paymentDate: (data as any).paymentDate ?? null,
                    confirmedDate: (data as any).confirmedDate ?? null,
                    receivedDate: (data as any).receivedDate ?? null
                };
            }

            return data;
        } catch (error) {
            throw this.toDomainError(error);
        }
    }

    /**
     * Exclui uma cobrança no Asaas (DELETE /v3/payments/{id}).
     * Só pode excluir cobranças pendentes; se já foi paga/cancelada, a API pode retornar erro.
     */
    async deletePayment(paymentId: string): Promise<{ deleted: boolean; id: string }> {
        if (!paymentId?.trim()) {
            throw new Error('paymentId is required');
        }
        const { data } = await this.http.delete<{ deleted?: boolean; id?: string }>(`/payments/${paymentId}`);
        return {
            deleted: data?.deleted === true,
            id: data?.id ?? paymentId
        };
    }

    /**
     * Marca a cobrança como recebida em dinheiro no Asaas (POST /v3/payments/{id}/receiveInCash).
     * Usado quando a escola dá baixa manual: o PIX/boleto fica marcado como pago no Asaas.
     */
    async receivePaymentInCash(
        paymentId: string,
        payload: { paymentDate: string; value: number; notifyCustomer?: boolean }
    ): Promise<void> {
        if (!paymentId?.trim()) throw new Error('paymentId is required');
        const body = {
            paymentDate: payload.paymentDate,
            value: payload.value,
            notifyCustomer: payload.notifyCustomer ?? false
        };
        await this.http.post(`/payments/${paymentId}/receiveInCash`, body);
    }

    async listPayments(params?: {
        status?: string;
        externalReference?: string;
        limit?: number;
        offset?: number;
    }): Promise<{
        data: Array<{
            id: string;
            status?: string;
            externalReference?: string | null;
            paymentDate?: string | null;
            confirmedDate?: string | null;
            receivedDate?: string | null;
            dueDate?: string | null;
            value?: number | null;
            transactionReceiptUrl?: string | null;
        }>;
        totalCount?: number;
    }> {
        try {
            const queryParams = new URLSearchParams();
            if (params?.status) queryParams.append('status', params.status);
            if (params?.externalReference) queryParams.append('externalReference', params.externalReference);
            if (params?.limit) queryParams.append('limit', String(params.limit));
            if (params?.offset) queryParams.append('offset', String(params.offset));

            const queryString = queryParams.toString();
            const url = `/payments${queryString ? `?${queryString}` : ''}`;
            
            const { data } = await this.http.get<{
                data?: Array<{
                    id: string;
                    status?: string;
                    externalReference?: string | null;
                    paymentDate?: string | null;
                    confirmedDate?: string | null;
                    receivedDate?: string | null;
                    dueDate?: string | null;
                    value?: number | null;
                    transactionReceiptUrl?: string | null;
                }>;
                totalCount?: number;
            }>(url);

            // A API pode retornar diretamente um array ou um objeto com data
            if (Array.isArray(data)) {
                return { data, totalCount: data.length };
            }

            if (data && typeof data === 'object' && 'data' in data) {
                return {
                    data: Array.isArray(data.data) ? data.data : [],
                    totalCount: data.totalCount
                };
            }

            return { data: [], totalCount: 0 };
        } catch (error) {
            throw this.toDomainError(error);
        }
    }

    /** Saldo da conta principal (API key usada no client). GET /finance/balance */
    async getMainAccountBalance(): Promise<{ balance: number }> {
        try {
            const { data } = await this.http.get<{ balance: number }>('/finance/balance');
            return {
                balance: typeof data?.balance === 'number' ? data.balance : 0
            };
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

    /**
     * Extrai a primeira URL de onboarding de um item (pode ser grupo com .documents[] ou item plano).
     * Suporta camelCase (onboardingUrl) e snake_case (onboarding_url).
     */
    private static pickOnboardingUrl(item: Record<string, unknown>): string | null {
        const url = (item?.onboardingUrl ?? item?.onboarding_url) as string | undefined;
        if (url && typeof url === 'string' && url.trim()) return url;
        const docs = item?.documents as Array<Record<string, unknown>> | undefined;
        if (Array.isArray(docs)) {
            for (const d of docs) {
                const u = (d?.onboardingUrl ?? d?.onboarding_url) as string | undefined;
                if (u && typeof u === 'string' && u.trim()) return u;
            }
        }
        return null;
    }

    /**
     * Obtém documentos pendentes da subconta (GET /v3/myAccount/documents).
     * Conforme doc Asaas: aguardar 15s após criar a subconta antes de chamar.
     * Retorna a estrutura completa para exibir grupos e extrair onboardingUrl.
     */
    async getMyAccountDocuments(accountApiKey: string): Promise<{ rejectReasons: string | null; data: Array<Record<string, unknown>> }> {
        if (!accountApiKey?.trim()) {
            return { rejectReasons: null, data: [] };
        }
        const baseUrl = this.http.defaults.baseURL || process.env.ASAAS_BASE_URL || 'https://www.asaas.com/api/v3';
        const client = axios.create({
            baseURL: baseUrl,
            headers: {
                access_token: accountApiKey,
                'Content-Type': 'application/json'
            },
            timeout: 30_000
        });
        const { data } = await client.get<{ rejectReasons?: string | null; data?: unknown[] }>('/myAccount/documents');
        const list = Array.isArray(data?.data) ? data.data : (data && typeof data === 'object' && Array.isArray((data as { data?: unknown[] }).data)) ? (data as { data: unknown[] }).data : [];
        const rejectReasons = (data && typeof data === 'object' && 'rejectReasons' in data) ? (data.rejectReasons ?? null) : null;
        return {
            rejectReasons: typeof rejectReasons === 'string' ? rejectReasons : null,
            data: list as Array<Record<string, unknown>>
        };
    }

    /**
     * Envia um documento para um grupo (POST /v3/myAccount/documents/{id}).
     * multipart/form-data: documentFile (arquivo) + type (ex.: IDENTIFICATION).
     * Deve ser chamado com a API key da subconta. Não enviar via API se o grupo já tiver onboardingUrl (Asaas rejeita).
     */
    async uploadMyAccountDocument(accountApiKey: string, documentGroupId: string, fileBuffer: Buffer, mimeType: string, type: string): Promise<void> {
        if (!accountApiKey?.trim() || !documentGroupId?.trim() || !type?.trim()) {
            throw new Error('accountApiKey, documentGroupId and type are required');
        }
        const baseUrl = this.http.defaults.baseURL || process.env.ASAAS_BASE_URL || 'https://www.asaas.com/api/v3';
        const form = new FormData();
        const ext = mimeType === 'application/pdf' ? 'pdf' : 'jpg';
        form.append('documentFile', fileBuffer, { filename: `document.${ext}`, contentType: mimeType });
        form.append('type', type);
        const client = axios.create({
            baseURL: baseUrl,
            headers: {
                access_token: accountApiKey,
                ...form.getHeaders()
            },
            timeout: 30_000
        });
        await client.post(`/myAccount/documents/${documentGroupId}`, form);
    }

    /**
     * Obtém o status cadastral da subconta (GET /v3/myAccount/status).
     * Chamar com a API key da subconta (access_token).
     * Retorna: id, commercialInfo, bankAccountInfo, documentation, general (ex.: APPROVED, AWAITING_APPROVAL).
     */
    async getMyAccountStatus(accountApiKey: string): Promise<{
        id: string;
        commercialInfo: string;
        bankAccountInfo: string;
        documentation: string;
        general: string;
    }> {
        if (!accountApiKey?.trim()) {
            throw new Error('accountApiKey is required');
        }
        const baseUrl = this.http.defaults.baseURL || process.env.ASAAS_BASE_URL || 'https://www.asaas.com/api/v3';
        const client = axios.create({
            baseURL: baseUrl,
            headers: {
                access_token: accountApiKey,
                'Content-Type': 'application/json'
            },
            timeout: 15_000
        });
        const { data } = await client.get<{ id: string; commercialInfo: string; bankAccountInfo: string; documentation: string; general: string }>('/myAccount/status');
        if (!data || typeof data !== 'object' || !data.id) {
            throw new Error('Asaas API returned invalid account status response');
        }
        return {
            id: data.id,
            commercialInfo: data.commercialInfo ?? '',
            bankAccountInfo: data.bankAccountInfo ?? '',
            documentation: data.documentation ?? '',
            general: data.general ?? ''
        };
    }

    /**
     * Cadastra conta bancária no Asaas no contexto da subconta (POST /v3/bankAccounts, header access_token).
     * Contrato alinhado ao payload de contas bancárias em transferências / integrações comuns Asaas v3.
     */
    async postBankAccountsWithAccessToken(
        accountApiKey: string,
        payload: Record<string, unknown>
    ): Promise<Record<string, unknown>> {
        if (!accountApiKey?.trim()) {
            throw new Error('accountApiKey is required');
        }
        const baseUrl = this.http.defaults.baseURL || process.env.ASAAS_BASE_URL || 'https://www.asaas.com/api/v3';
        const client = axios.create({
            baseURL: baseUrl,
            headers: {
                access_token: accountApiKey,
                'Content-Type': 'application/json'
            },
            timeout: 30_000
        });
        try {
            const { data } = await client.post<Record<string, unknown>>('/bankAccounts', payload);
            if (!data || typeof data !== 'object') {
                throw new Error('Asaas API returned invalid bank account response');
            }
            const errs = (data as { errors?: Array<{ description?: string; message?: string }> }).errors;
            if (Array.isArray(errs) && errs.length > 0) {
                const msg = errs
                    .map((e) => (e && typeof e === 'object' ? e.description ?? e.message : ''))
                    .filter((s): s is string => typeof s === 'string' && s.length > 0)
                    .join('; ');
                throw new Error(`Asaas rejected bank account${msg ? `: ${msg}` : ''}`);
            }
            const idStr = pickAsaasBankAccountId(data as Record<string, unknown>);
            if (!idStr) {
                const keys = Object.keys(data as object);
                log.warn('[Asaas] POST /bankAccounts: resposta sem id reconhecível', { keys });
                throw new Error('Asaas API returned bank account response without id');
            }
            return { ...(data as Record<string, unknown>), id: idStr };
        } catch (error) {
            throw this.toDomainError(error);
        }
    }

    /**
     * Obtém a URL de onboarding (documentos pendentes) no contexto da subconta.
     * Deve ser chamado com a API key da subconta; Asaas recomenda aguardar ~15s após criar a subconta.
     * Suporta resposta em formato de lista plana ou com grupos contendo .documents[].
     *
     * Contrato Asaas: GET /v3/myAccount/documents, header access_token (API key da subconta).
     * Resposta: { data?: Array<{ id, type, status, onboardingUrl?, documents? }> }. onboardingUrl pode vir null
     * (ex.: sandbox sem whitelabel liberado ou subconta fora do fluxo whitelabel).
     */
    async getMyAccountOnboardingUrl(accountApiKey: string): Promise<string | null> {
        if (!accountApiKey?.trim()) return null;
        try {
            const { data: items } = await this.getMyAccountDocuments(accountApiKey);
            for (const item of items) {
                const url = AsaasClient.pickOnboardingUrl(item);
                if (url) return url;
            }
            return null;
        } catch (err: unknown) {
            if (axios.isAxiosError(err)) {
                const status = err.response?.status;
                const code = err.response?.data?.errors?.[0]?.code;
                const description = err.response?.data?.errors?.[0]?.description;
                log.warn('[Asaas] getMyAccountOnboardingUrl: falha na requisição', {
                    status,
                    code,
                    description: description ?? err.message
                });
            } else {
                log.warn('[Asaas] getMyAccountOnboardingUrl: erro', { error: err instanceof Error ? err.message : String(err) });
            }
            return null;
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
