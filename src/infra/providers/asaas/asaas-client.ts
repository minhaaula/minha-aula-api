import axios, { AxiosInstance } from 'axios';
export class AsaasClient {
    private http: AxiosInstance;
    constructor(apiKey: string, baseUrl = process.env.ASAAS_BASE_URL || 'https://www.asaas.com/api/v3') {
        this.http = axios.create({
            baseURL: baseUrl,
            headers: { Authorization: `Bearer ${apiKey}` }
        });
    }
}