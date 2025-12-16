import { SchoolWithdrawal } from '../../domain/entities/school-withdrawal';
import { SchoolRepository } from '../../ports/repositories/school.repo';
import { SchoolBankAccountRepository } from '../../ports/repositories/school-bank-account.repo';
import { SchoolWithdrawalRepository } from '../../ports/repositories/school-withdrawal.repo';
import { SchoolFinancialChargeRepository } from '../../ports/repositories/school-financial-charge.repo';
import { AsaasProviderPort } from '../../ports/providers/asaas-port';
import { AsaasProvider } from '../../infra/providers/asaas/asaas-provider';
import { Money } from '../../domain/value-objects/money';
import { Uuid } from '../../shared/uuid';

export interface RequestSchoolWithdrawalInput {
    schoolId: string;
    amount: number; // valor em reais
    bankAccountId: string;
}

export interface RequestSchoolWithdrawalOutput {
    withdrawalId: string;
    status: string;
    amount: number;
    amountCents: number;
}

export class RequestSchoolWithdrawal {
    constructor(
        private readonly schools: SchoolRepository,
        private readonly bankAccounts: SchoolBankAccountRepository,
        private readonly withdrawals: SchoolWithdrawalRepository,
        private readonly financialCharges: SchoolFinancialChargeRepository,
        private readonly asaasProvider?: AsaasProviderPort
    ) {}

    async exec(input: RequestSchoolWithdrawalInput): Promise<RequestSchoolWithdrawalOutput> {
        const schoolId = input.schoolId?.trim();
        if (!schoolId) {
            throw new Error('School id is required');
        }

        const amount = input.amount;
        if (!Number.isFinite(amount) || amount <= 0) {
            throw new Error('Valor do saque deve ser maior que zero');
        }

        const amountCents = Math.round(amount * 100);
        if (amountCents <= 0) {
            throw new Error('Valor do saque inválido');
        }

        // Buscar escola
        const school = await this.schools.findById(schoolId);
        if (!school) {
            throw new Error('Escola não encontrada');
        }

        // Verificar se a escola tem conta ASSAAS
        if (!school.accountId) {
            throw new Error('Escola não possui conta ASSAAS configurada');
        }

        // Verificar se a escola tem API key da conta ASSAAS
        if (!school.accountApiKey || !school.accountApiKey.trim()) {
            throw new Error('Escola não possui API key da conta ASSAAS configurada');
        }

        // Buscar conta bancária
        const bankAccount = await this.bankAccounts.findById(input.bankAccountId);
        if (!bankAccount) {
            throw new Error('Conta bancária não encontrada');
        }

        // Verificar se a conta bancária pertence à escola
        if (bankAccount.schoolId !== schoolId) {
            throw new Error('Conta bancária não pertence à escola');
        }

        // Verificar se a conta bancária está ativa
        if (!bankAccount.isActive) {
            throw new Error('Conta bancária não está ativa');
        }

        // Verificar saldo disponível
        if (!this.financialCharges.findPaidChargesBySchoolId) {
            throw new Error('Repositório de cobranças não suporta busca de pagamentos pagos');
        }

        const allPaidCharges = await this.financialCharges.findPaidChargesBySchoolId(schoolId);
        const availableBalanceCents = allPaidCharges.reduce(
            (sum, charge) => sum + charge.netAmountCents,
            0
        );

        if (amountCents > availableBalanceCents) {
            throw new Error(`Saldo insuficiente. Saldo disponível: R$ ${(availableBalanceCents / 100).toFixed(2)}`);
        }

        // Criar registro de saque
        const withdrawalId = Uuid();
        const withdrawal = SchoolWithdrawal.create({
            id: withdrawalId,
            schoolId,
            amountCents,
            bankName: bankAccount.bankName,
            bankAgency: bankAccount.bankAgency,
            bankAccount: bankAccount.bankAccount,
            pixKey: bankAccount.pixKey,
            status: 'PROCESSING'
        });

        // Salvar saque no banco
        await this.withdrawals.save(withdrawal);

        // Criar provider com a API key da subconta da escola
        const baseUrl = process.env.ASAAS_BASE_URL || 'https://www.asaas.com/api/v3';
        const schoolAsaasProvider = new AsaasProvider({ 
            apiKey: school.accountApiKey.trim(), 
            baseUrl 
        });

        // Tentar criar transferência no ASSAAS usando a API key da escola
        try {
            const transferResult = await schoolAsaasProvider.createTransfer({
                accountId: school.accountId,
                amount: Money.of(amountCents, 'BRL'),
                bankAccount: bankAccount.bankAccount,
                bankAccountDigit: bankAccount.bankAccountDigit ?? undefined,
                bankAgency: bankAccount.bankAgency,
                bankAgencyDigit: bankAccount.bankAgencyDigit ?? undefined,
                bankCode: bankAccount.bankCode ? String(bankAccount.bankCode) : '',
                accountType: bankAccount.bankAccountType,
                documentHolder: bankAccount.bankAccountHolderDocument,
                pixKey: bankAccount.pixKey ?? undefined
            });

            // Se a transferência foi criada com sucesso, atualizar status
            if (transferResult.status === 'DONE' || transferResult.status === 'COMPLETED') {
                withdrawal.markAsCompleted(transferResult.effectiveDate);
            } else if (transferResult.status === 'CANCELLED' || transferResult.status === 'FAILED') {
                withdrawal.markAsCancelled();
            }

            await this.withdrawals.save(withdrawal);
        } catch (error) {
            // Se houver erro na transferência, manter como PROCESSING
            // O erro será tratado posteriormente via webhook ou processo assíncrono
            console.error('Erro ao criar transferência no ASSAAS:', error);
        }

        return {
            withdrawalId: withdrawal.id,
            status: withdrawal.status,
            amount: amount,
            amountCents: withdrawal.amountCents
        };
    }
}


