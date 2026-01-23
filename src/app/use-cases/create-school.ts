import { SchoolRepository } from '../../ports/repositories/school.repo';
import { School } from '../../domain/entities/school';
import { Uuid } from '../../shared/uuid';
import { PostalAddress, type PostalAddressProps } from '../../domain/value-objects/postal-address';
import { PasswordHasherPort } from '../../ports/providers/password-hasher.port';
import { AsaasProviderPort } from '../../ports/providers/asaas-port';
import type { CreateSchoolInput, CreateSchoolOutput } from '../types/school.types';

export class CreateSchool {
    constructor(
        private readonly schools: SchoolRepository,
        private readonly passwordHasher: PasswordHasherPort,
        private readonly asaasProvider?: AsaasProviderPort
    ) {}

    async exec(input: CreateSchoolInput): Promise<CreateSchoolOutput> {
        const addresses = (input.addresses ?? []).map((address) => PostalAddress.create({
            street: address.street,
            number: address.number,
            complement: address.complement ?? null,
            district: address.district ?? null,
            city: address.city,
            state: address.state,
            zipCode: address.zipCode
        }));

        const ownerFieldsProvided = [input.ownerName, input.ownerCpf, input.ownerEmail, input.ownerPassword]
            .some((value) => value !== undefined && value !== null);
        if (ownerFieldsProvided) {
            const { AppError, ErrorCode } = await import('../../shared/errors.js');
            if (!input.ownerName || !input.ownerCpf || !input.ownerEmail || !input.ownerPassword) {
                throw AppError.fromCode(ErrorCode.INCOMPLETE_DATA, { message: 'School owner information is incomplete' });
            }
        }

        const ownerPasswordHash = input.ownerPassword
            ? await this.passwordHasher.hash(input.ownerPassword)
            : null;

        const school = School.create({
            id: Uuid(),
            name: input.name,
            addresses,
            email: input.email,
            phone: input.phone,
            cnpj: input.cnpj,
            ownerUserId: input.ownerUserId ?? null,
            ownerName: input.ownerName ?? null,
            ownerCpf: input.ownerCpf ?? null,
            ownerEmail: input.ownerEmail ?? null,
            ownerPasswordHash,
            incomeValue: input.incomeValue
        });
        await this.schools.save(school);

        // Criar subconta no Asaas se o provider estiver disponível
        let kycUrl: string | null = null;
        if (this.asaasProvider?.createSubAccount && addresses.length > 0) {
            try {
                const mainAddress = addresses[0];
                const companyType = 'LIMITED'; // Tipo padrão para escolas
                const incomeValue = input.incomeValue && input.incomeValue > 0 ? input.incomeValue : 5000;

                // Validar dados necessários
                if (mainAddress.street && mainAddress.number && mainAddress.zipCode && mainAddress.zipCode.length === 8) {
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

                    // Aguardar 15 segundos antes de buscar documentos pendentes (conforme documentação do Asaas)
                    // Depois buscar documentos pendentes para obter o link de onboarding
                    if (subAccount.apiKey) {
                        try {
                            // Aguardar 15 segundos
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
                                    kycUrl = docWithUrl.onboardingUrl;
                                    // Atualizar a escola com o onboardingUrl
                                    updatedSchool = updatedSchool.withOnboardingUrl(kycUrl);
                                    await this.schools.save(updatedSchool);
                                }
                            }
                        } catch (error) {
                            console.warn('Failed to fetch pending documents for KYC URL:', error);
                        }
                    }
                }
            } catch (error) {
                // Log do erro mas não falha a criação da escola
                console.error('Failed to create Asaas subaccount during school creation:', error);
            }
        }

        return {
            id: school.id,
            name: school.name,
            email: school.email,
            phone: school.phone,
            cnpj: school.cnpj,
            addresses: school.addresses.map((address) => address.toPrimitives()),
            createdAt: school.createdAt,
            ownerUserId: school.ownerUserId,
            ownerName: school.ownerName,
            ownerCpf: school.ownerCpf,
            ownerEmail: school.ownerEmail,
            incomeValue: school.incomeValue,
            kycUrl
        };
    }
}
