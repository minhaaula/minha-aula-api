import { SchoolRepository } from '../../ports/repositories/school.repo';
import { AsaasProviderPort } from '../../ports/providers/asaas-port';
import { AppError, ErrorCode } from '../../shared/errors';

export interface ResendSchoolAsaasAccountInput {
    schoolId: string;
}

export interface ResendSchoolAsaasAccountOutput {
    schoolId: string;
    accountId: string | null;
    walletId: string | null;
    onboardingUrl: string | null;
    success: boolean;
    message: string;
}

export class ResendSchoolAsaasAccount {
    constructor(
        private readonly schools: SchoolRepository,
        private readonly asaasProvider?: AsaasProviderPort
    ) {}

    async exec(input: ResendSchoolAsaasAccountInput): Promise<ResendSchoolAsaasAccountOutput> {
        const schoolId = input.schoolId.trim();
        if (!schoolId) {
            throw AppError.fromCode(ErrorCode.REQUIRED_FIELD, { field: 'schoolId' });
        }

        const school = await this.schools.findById(schoolId);
        if (!school) {
            throw AppError.fromCode(ErrorCode.SCHOOL_NOT_FOUND, { schoolId });
        }

        if (!this.asaasProvider?.createSubAccount) {
            return {
                schoolId: school.id,
                accountId: school.accountId,
                walletId: school.walletId,
                onboardingUrl: school.onboardingUrl,
                success: false,
                message: 'Asaas provider não está configurado'
            };
        }

        // Verificar se a escola tem endereço (necessário para criar conta)
        if (school.addresses.length === 0) {
            return {
                schoolId: school.id,
                accountId: school.accountId,
                walletId: school.walletId,
                onboardingUrl: school.onboardingUrl,
                success: false,
                message: 'Escola precisa ter pelo menos um endereço cadastrado para criar conta no Asaas'
            };
        }

        const mainAddress = school.addresses[0];
        if (!mainAddress.street || !mainAddress.number || !mainAddress.zipCode || mainAddress.zipCode.length !== 8) {
            return {
                schoolId: school.id,
                accountId: school.accountId,
                walletId: school.walletId,
                onboardingUrl: school.onboardingUrl,
                success: false,
                message: 'Endereço da escola está incompleto (necessário: rua, número e CEP com 8 dígitos)'
            };
        }

        try {
            const companyType = 'LIMITED'; // Tipo padrão para escolas
            const incomeValue = school.incomeValue && school.incomeValue > 0 ? school.incomeValue : 5000;

            // Criar subconta no Asaas
            const subAccount = await this.asaasProvider.createSubAccount({
                name: school.name,
                email: school.email,
                cpfCnpj: school.cnpj,
                phone: school.phone,
                externalReference: school.id,
                companyType,
                incomeValue,
                address: mainAddress.street,
                addressNumber: mainAddress.number,
                complement: mainAddress.complement ?? null,
                province: mainAddress.district ?? null,
                postalCode: mainAddress.zipCode
            });

            // Atualizar escola com accountId, accountApiKey e walletId
            let updatedSchool = school.withAccountId(subAccount.id);
            if (subAccount.apiKey) {
                updatedSchool = updatedSchool.withAccountApiKey(subAccount.apiKey);
            }
            if (subAccount.walletId) {
                updatedSchool = updatedSchool.withWalletId(subAccount.walletId);
            }
            await this.schools.save(updatedSchool);

            let onboardingUrl: string | null = school.onboardingUrl;

            // Aguardar 15 segundos antes de buscar documentos pendentes (conforme documentação do Asaas)
            if (subAccount.apiKey) {
                try {
                    await new Promise(resolve => setTimeout(resolve, 15000));
                    
                    // Buscar documentos pendentes usando a API key da subconta
                    const axios = (await import('axios')).default;
                    const baseUrl = process.env.ASAAS_BASE_URL || 'https://www.asaas.com/api/v3';
                    
                    const documentsResponse = await axios.get(`${baseUrl}/myAccount/documents`, {
                        headers: {
                            'access_token': subAccount.apiKey,
                            'Content-Type': 'application/json'
                        }
                    });

                    const documents = documentsResponse.data?.data || documentsResponse.data || [];
                    
                    // Encontrar o primeiro onboardingUrl disponível
                    if (Array.isArray(documents) && documents.length > 0) {
                        const docWithUrl = documents.find((doc: any) => doc.onboardingUrl);
                        if (docWithUrl?.onboardingUrl) {
                            onboardingUrl = docWithUrl.onboardingUrl;
                            // Atualizar a escola com o onboardingUrl
                            updatedSchool = updatedSchool.withOnboardingUrl(onboardingUrl);
                            await this.schools.save(updatedSchool);
                        }
                    }
                } catch (error) {
                    console.warn('Failed to fetch pending documents for KYC URL:', error);
                }
            }

            return {
                schoolId: school.id,
                accountId: subAccount.id,
                walletId: subAccount.walletId ?? null,
                onboardingUrl,
                success: true,
                message: 'Conta Asaas criada/atualizada com sucesso'
            };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido ao criar conta no Asaas';
            console.error('Failed to create/update Asaas subaccount:', error);
            
            return {
                schoolId: school.id,
                accountId: school.accountId,
                walletId: school.walletId,
                onboardingUrl: school.onboardingUrl,
                success: false,
                message: `Erro ao criar conta no Asaas: ${errorMessage}`
            };
        }
    }
}
