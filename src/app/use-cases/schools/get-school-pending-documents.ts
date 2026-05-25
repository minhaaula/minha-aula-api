import { SchoolRepository } from '../../../ports/repositories/school.repo';
import { AsaasProviderPort } from '../../../ports/providers/asaas-port';

export interface GetSchoolPendingDocumentsInput {
    schoolId: string;
}

export interface PendingDocument {
    id: string;
    type: string;
    title: string;
    description: string;
    status: string;
    onboardingUrl: string | null;
    onboardingUrlExpirationDate?: string | null;
    responsible?: {
        name: string | null;
        type: string;
    } | null;
}

export interface GetSchoolPendingDocumentsOutput {
    documents: PendingDocument[];
    onboardingUrl: string | null;
}

export class GetSchoolPendingDocuments {
    constructor(
        private readonly schools: SchoolRepository,
        private readonly asaasProvider?: AsaasProviderPort
    ) {}

    async exec(input: GetSchoolPendingDocumentsInput): Promise<GetSchoolPendingDocumentsOutput> {
        const school = await this.schools.findById(input.schoolId);
        if (!school) {
            throw new Error('School not found');
        }

        if (!school.accountApiKey) {
            return {
                documents: [],
                onboardingUrl: school.onboardingUrl
            };
        }

        if (!this.asaasProvider?.getAccount) {
            return {
                documents: [],
                onboardingUrl: school.onboardingUrl
            };
        }

        // Buscar documentos pendentes usando a API key da subconta
        let documents: PendingDocument[] = [];
        let onboardingUrl: string | null = school.onboardingUrl;

        try {
            // Usar axios diretamente para buscar documentos pendentes
            const axios = (await import('axios')).default;
            const baseUrl = process.env.ASAAS_BASE_URL || 'https://www.asaas.com/api/v3';
            
            const response = await axios.get(`${baseUrl}/myAccount/documents`, {
                headers: {
                    'access_token': school.accountApiKey,
                    'Content-Type': 'application/json'
                }
            });

            const responseData = response.data?.data || response.data || [];
            
            if (Array.isArray(responseData) && responseData.length > 0) {
                documents = responseData.map((doc: any) => ({
                    id: doc.id || '',
                    type: doc.type || '',
                    title: doc.title || '',
                    description: doc.description || '',
                    status: doc.status || '',
                    onboardingUrl: doc.onboardingUrl || null,
                    onboardingUrlExpirationDate: doc.onboardingUrlExpirationDate || null,
                    responsible: doc.responsible || null
                }));

                // Encontrar o primeiro onboardingUrl disponível
                const docWithUrl = documents.find((doc) => doc.onboardingUrl);
                if (docWithUrl?.onboardingUrl && !onboardingUrl) {
                    onboardingUrl = docWithUrl.onboardingUrl;
                    
                    // Atualizar a escola com o onboardingUrl
                    const updatedSchool = school.withOnboardingUrl(onboardingUrl);
                    await this.schools.save(updatedSchool);
                }
            }
        } catch (error: any) {
            // Se falhar, retornar o onboardingUrl que já está salvo
            console.warn('Failed to fetch pending documents:', error.message);
        }

        return {
            documents,
            onboardingUrl
        };
    }
}

