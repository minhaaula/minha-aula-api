import { SchoolWithdrawal } from '../../domain/entities/school-withdrawal';
import { SchoolRepository } from '../../ports/repositories/school.repo';
import { SchoolBankAccountRepository } from '../../ports/repositories/school-bank-account.repo';
import { SchoolWithdrawalRepository } from '../../ports/repositories/school-withdrawal.repo';
import { Money } from '../../domain/value-objects/money';
import { Uuid } from '../../shared/uuid';
import { AppError, ErrorCode } from '../../shared/errors';
import { log } from '../../shared/logger';
import { ConsumeSchoolActionOtp } from './consume-school-action-otp';

export interface RequestSchoolWithdrawalInput {
    schoolId: string;
    amount: number; // valor em reais
    bankAccountId: string;
    otpChallengeId: string;
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
        private readonly otp?: ConsumeSchoolActionOtp
    ) {}

    async exec(input: RequestSchoolWithdrawalInput): Promise<RequestSchoolWithdrawalOutput> {
        const schoolId = input.schoolId?.trim();
        if (!schoolId) {
            throw AppError.validation('Identificação da escola é obrigatória');
        }

        if (!input.otpChallengeId?.trim()) {
            throw AppError.validation('OTP é obrigatório para confirmar o saque');
        }

        const amount = input.amount;
        if (!Number.isFinite(amount) || amount <= 0) {
            throw AppError.validation('Valor do saque deve ser maior que zero');
        }

        const amountCents = Math.round(amount * 100);
        if (amountCents <= 0) {
            throw AppError.validation('Valor do saque inválido');
        }

        const school = await this.schools.findById(schoolId);
        if (!school) {
            throw AppError.fromCode(ErrorCode.SCHOOL_NOT_FOUND, { schoolId });
        }

        if (!school.accountId?.trim()) {
            throw AppError.fromCode(ErrorCode.INCOMPLETE_DATA, {
                message: 'Escola não possui conta Asaas configurada'
            });
        }

        if (!school.accountApiKey?.trim()) {
            throw AppError.fromCode(ErrorCode.INCOMPLETE_DATA, {
                message: 'Escola não possui API key da conta Asaas'
            });
        }

        const bankAccount = await this.bankAccounts.findById(input.bankAccountId);
        if (!bankAccount) {
            throw AppError.notFound('Conta bancária', { bankAccountId: input.bankAccountId });
        }

        if (bankAccount.schoolId !== schoolId) {
            throw AppError.validation('Conta bancária não pertence à escola', {
                bankAccountId: input.bankAccountId
            });
        }

        if (!bankAccount.isActive) {
            throw AppError.validation('Conta bancária não está ativa', { bankAccountId: input.bankAccountId });
        }

        await this.otp?.exec({
            schoolId,
            challengeId: input.otpChallengeId,
            purpose: 'WITHDRAWAL'
        });

        const { AsaasProviderFactory } = await import('../../infra/providers/asaas/asaas-provider-factory.js');
        const schoolAsaasProvider = AsaasProviderFactory.createSubAccountProvider(school.accountApiKey);
        if (!schoolAsaasProvider?.getAccountBalance || !schoolAsaasProvider.createTransfer) {
            throw AppError.fromCode(ErrorCode.CONFIGURATION_ERROR, {
                message: 'Operação de saque não disponível (Asaas sem saldo/transferência)'
            });
        }

        let availableBalanceCents: number;
        try {
            const balance = await schoolAsaasProvider.getAccountBalance(school.accountId);
            availableBalanceCents = Math.round(balance.availableBalance * 100);
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : String(err);
            log.error('[RequestSchoolWithdrawal] Falha ao consultar saldo Asaas', { schoolId, error: msg });
            throw AppError.fromCode(ErrorCode.EXTERNAL_SERVICE_ERROR, {
                message: `Não foi possível consultar o saldo na conta Asaas: ${msg}`
            });
        }

        if (amountCents > availableBalanceCents) {
            throw AppError.fromCode(ErrorCode.BUSINESS_RULE_VIOLATION, {
                message: `Saldo insuficiente na conta Asaas. Disponível: R$ ${(availableBalanceCents / 100).toFixed(2)}`,
                availableBalanceCents
            });
        }

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

        await this.withdrawals.save(withdrawal);

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

            if (transferResult.status === 'DONE' || transferResult.status === 'COMPLETED') {
                withdrawal.markAsCompleted(transferResult.effectiveDate);
            } else if (transferResult.status === 'CANCELLED' || transferResult.status === 'FAILED') {
                withdrawal.markAsCancelled();
            }

            await this.withdrawals.save(withdrawal);

            if (transferResult.status === 'CANCELLED' || transferResult.status === 'FAILED') {
                throw AppError.fromCode(ErrorCode.EXTERNAL_SERVICE_ERROR, {
                    message: 'Asaas recusou ou cancelou a transferência',
                    transferStatus: transferResult.status
                });
            }
        } catch (err: unknown) {
            if (err instanceof AppError) {
                throw err;
            }
            const msg = err instanceof Error ? err.message : String(err);
            log.error('[RequestSchoolWithdrawal] Erro ao criar transferência no Asaas', { schoolId, withdrawalId, error: msg });
            try {
                withdrawal.markAsCancelled();
                await this.withdrawals.save(withdrawal);
            } catch {
                // melhor esforço para persistir cancelamento
            }
            throw AppError.fromCode(ErrorCode.EXTERNAL_SERVICE_ERROR, {
                message: `Falha ao solicitar saque no Asaas: ${msg}`
            });
        }

        return {
            withdrawalId: withdrawal.id,
            status: withdrawal.status,
            amount,
            amountCents: withdrawal.amountCents
        };
    }
}
