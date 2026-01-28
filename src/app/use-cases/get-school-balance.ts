import { SchoolRepository } from '../../ports/repositories/school.repo';
import { AsaasProviderPort } from '../../ports/providers/asaas-port';
import { AppError, ErrorCode } from '../../shared/errors';
import { AsaasProvider } from '../../infra/providers/asaas/asaas-provider';

export interface GetSchoolBalanceInput {
    schoolId: string;
}

export interface GetSchoolBalanceOutput {
    balanceCents: number;
    availableBalanceCents: number;
    blockedBalanceCents: number | null;
    accountId: string | null;
    hasAsaasAccount: boolean;
}

export class GetSchoolBalance {
    constructor(
        private readonly schools: SchoolRepository,
        private readonly asaasProvider?: AsaasProviderPort
    ) {}

    async exec(input: GetSchoolBalanceInput): Promise<GetSchoolBalanceOutput> {
        const schoolId = input.schoolId.trim();
        if (!schoolId) {
            throw AppError.fromCode(ErrorCode.VALIDATION_ERROR, {
                message: 'School ID is required'
            });
        }

        const school = await this.schools.findById(schoolId);
        if (!school) {
            throw AppError.fromCode(ErrorCode.SCHOOL_NOT_FOUND, { schoolId });
        }

        // Verificar se a escola tem conta Asaas configurada
        if (!school.accountId || !school.accountId.trim()) {
            return {
                balanceCents: 0,
                availableBalanceCents: 0,
                blockedBalanceCents: null,
                accountId: null,
                hasAsaasAccount: false
            };
        }

        // Verificar se o provider tem o método getAccountBalance
        if (!this.asaasProvider || !this.asaasProvider.getAccountBalance) {
            throw AppError.fromCode(ErrorCode.CONFIGURATION_ERROR, {
                message: 'Asaas provider não está configurado ou não suporta consulta de saldo'
            });
        }

        // Verificar se a escola tem API key da subconta
        if (!school.accountApiKey || !school.accountApiKey.trim()) {
            return {
                balanceCents: 0,
                availableBalanceCents: 0,
                blockedBalanceCents: null,
                accountId: school.accountId,
                hasAsaasAccount: true
            };
        }

        try {
            // Criar provider com a API key da subconta da escola
            const { AsaasProviderFactory } = await import('../../infra/providers/asaas/asaas-provider-factory.js');
            const schoolAsaasProvider = AsaasProviderFactory.createSubAccountProvider(school.accountApiKey);
            if (!schoolAsaasProvider) {
                throw new Error('Failed to create Asaas provider for school subaccount');
            }

            // Buscar saldo da conta Asaas
            if (!schoolAsaasProvider.getAccountBalance) {
                throw new Error('Asaas provider does not support getAccountBalance');
            }
            const balance = await schoolAsaasProvider.getAccountBalance(school.accountId);

            // Converter valores de reais para centavos
            const balanceCents = Math.round(balance.balance * 100);
            const availableBalanceCents = Math.round(balance.availableBalance * 100);
            const blockedBalanceCents = balance.blockedBalance !== undefined
                ? Math.round(balance.blockedBalance * 100)
                : null;

            return {
                balanceCents,
                availableBalanceCents,
                blockedBalanceCents,
                accountId: school.accountId,
                hasAsaasAccount: true
            };
        } catch (error) {
            // Se houver erro ao buscar saldo, retornar erro
            const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido ao buscar saldo';
            throw AppError.fromCode(ErrorCode.EXTERNAL_SERVICE_ERROR, {
                message: `Erro ao buscar saldo no Asaas: ${errorMessage}`,
                accountId: school.accountId
            });
        }
    }
}
