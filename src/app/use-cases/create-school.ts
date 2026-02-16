import { SchoolRepository } from '../../ports/repositories/school.repo';
import { UserRepository } from '../../ports/repositories/user.repo';
import { School } from '../../domain/entities/school';
import { User } from '../../domain/entities/user';
import { Uuid } from '../../shared/uuid';
import { Email } from '../../domain/value-objects/email';
import { PostalAddress, type PostalAddressProps } from '../../domain/value-objects/postal-address';
import { PasswordHasherPort } from '../../ports/providers/password-hasher.port';
import { AsaasProviderPort } from '../../ports/providers/asaas-port';
import { UserPersonaEnum } from '../../domain/value-objects/user-persona';
import { AppError, ErrorCode } from '../../shared/errors';
import type { CreateSchoolInput, CreateSchoolOutput } from '../types/school.types';

/** Data de nascimento padrão para o usuário dono quando não é informada (User exige birthDate). */
const DEFAULT_OWNER_BIRTH_DATE = new Date('1980-01-01');

export class CreateSchool {
    constructor(
        private readonly schools: SchoolRepository,
        private readonly passwordHasher: PasswordHasherPort,
        private readonly asaasProvider?: AsaasProviderPort,
        private readonly users?: UserRepository
    ) {}

    async exec(input: CreateSchoolInput): Promise<CreateSchoolOutput> {
        // Evitar escolas duplicadas: e-mail e CNPJ devem ser únicos.
        const emailNorm = input.email.trim().toLowerCase();
        if (this.schools.findByEmail) {
            const existingByEmail = await this.schools.findByEmail(emailNorm);
            if (existingByEmail) {
                throw AppError.fromCode(ErrorCode.BUSINESS_RULE_VIOLATION, {
                    message: 'Já existe uma escola cadastrada com este e-mail.'
                });
            }
        }
        const cnpjDigits = input.cnpj.replace(/\D/g, '');
        if (cnpjDigits.length === 14 && this.schools.findByCnpj) {
            const existingByCnpj = await this.schools.findByCnpj(cnpjDigits);
            if (existingByCnpj) {
                throw AppError.fromCode(ErrorCode.BUSINESS_RULE_VIOLATION, {
                    message: 'Já existe uma escola cadastrada com este CNPJ.'
                });
            }
        }

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

        let ownerUserId: string | null = input.ownerUserId ?? null;

        // Se temos dados do dono mas não temos ownerUserId, criar usuário (persona SCHOOL) e vincular.
        // Assim a escola passa a ter owner_user_id e o dono pode ser referenciado em outros fluxos.
        if (!ownerUserId && ownerPasswordHash && input.ownerName && input.ownerCpf && input.ownerEmail && this.users && addresses.length > 0) {
            const ownerEmailNorm = input.ownerEmail.trim().toLowerCase();
            const ownerCpfDigits = input.ownerCpf.replace(/\D/g, '');
            const existingByEmail = await this.users.findByEmail(ownerEmailNorm);
            const existingByCpf = ownerCpfDigits.length === 11 ? await this.users.findByCpf(ownerCpfDigits) : null;
            if (!existingByEmail && !existingByCpf) {
                const ownerId = Uuid();
                const mainAddress = addresses[0];
                const ownerAddress = PostalAddress.create({
                    street: mainAddress.street,
                    number: mainAddress.number,
                    complement: mainAddress.complement ?? null,
                    district: mainAddress.district ?? null,
                    city: mainAddress.city,
                    state: mainAddress.state,
                    zipCode: mainAddress.zipCode
                });
                const ownerUser = User.create({
                    id: ownerId,
                    fullName: input.ownerName.trim(),
                    birthDate: DEFAULT_OWNER_BIRTH_DATE,
                    email: Email.create(input.ownerEmail),
                    phone: input.phone,
                    cpf: ownerCpfDigits,
                    address: ownerAddress,
                    persona: UserPersonaEnum.SCHOOL,
                    passwordHash: ownerPasswordHash
                });
                await this.users.save(ownerUser);
                ownerUserId = ownerId;
            }
        }

        const school = School.create({
            id: Uuid(),
            name: input.name,
            addresses,
            email: input.email,
            phone: input.phone,
            cnpj: input.cnpj,
            ownerUserId,
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
