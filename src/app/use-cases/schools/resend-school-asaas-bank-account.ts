import type { SchoolRepository } from '../../../ports/repositories/school.repo';
import type { SchoolBankAccountRepository } from '../../../ports/repositories/school-bank-account.repo';
import type { AsaasProviderPort, AsaasReceivingBankAccountResult } from '../../../ports/providers/asaas-port';
import { AppError, ErrorCode } from '../../../shared/errors';
import { ConsumeSchoolActionOtp } from '../shared/consume-school-action-otp';

function assertSuccessfulAsaasReceivingBankAccount(res: AsaasReceivingBankAccountResult): void {
    const id = (res as { id?: unknown }).id;
    if (typeof id !== 'string' || !id.trim()) {
        throw AppError.fromCode(ErrorCode.EXTERNAL_SERVICE_ERROR, {
            message: 'Resposta inválida do Asaas ao cadastrar conta bancária'
        });
    }
    const rawErrors = (res as { errors?: unknown }).errors;
    if (Array.isArray(rawErrors) && rawErrors.length > 0) {
        throw AppError.fromCode(ErrorCode.EXTERNAL_SERVICE_ERROR, {
            message: 'Asaas rejeitou o cadastro da conta bancária'
        });
    }
}

export type ResendSchoolAsaasBankAccountInput = {
    schoolId: string;
    otpChallengeId: string;
    /**
     * Opcional. Se não informado, tenta reenviar a conta bancária ativa da escola.
     */
    bankAccountId?: string | null;
};

export type ResendSchoolAsaasBankAccountOutput = {
    schoolId: string;
    bankAccountId: string;
    asaas: AsaasReceivingBankAccountResult;
};

/**
 * Reenvia (sincroniza) os dados de conta bancária da escola para o Asaas (subconta).
 * Útil quando `bankAccountInfo` está REJECTED/PENDING e a escola precisa reenviar os dados.
 */
export class ResendSchoolAsaasBankAccount {
    constructor(
        private readonly schools: SchoolRepository,
        private readonly bankAccounts: SchoolBankAccountRepository,
        private readonly otp: ConsumeSchoolActionOtp,
        private readonly asaasProvider?: AsaasProviderPort
    ) {}

    async exec(input: ResendSchoolAsaasBankAccountInput): Promise<ResendSchoolAsaasBankAccountOutput> {
        const schoolId = input.schoolId?.trim();
        if (!schoolId) {
            throw AppError.fromCode(ErrorCode.REQUIRED_FIELD, { field: 'schoolId' });
        }

        const otpChallengeId = input.otpChallengeId?.trim();
        if (!otpChallengeId) {
            throw AppError.fromCode(ErrorCode.REQUIRED_FIELD, { field: 'otpChallengeId' });
        }

        const school = await this.schools.findById(schoolId);
        if (!school) {
            throw AppError.fromCode(ErrorCode.SCHOOL_NOT_FOUND, { schoolId });
        }
        if (!school.accountApiKey?.trim()) {
            throw AppError.fromCode(ErrorCode.VALIDATION_ERROR, {
                message: 'Escola não possui API key da subconta Asaas'
            });
        }
        if (!this.asaasProvider?.createReceivingBankAccount) {
            throw AppError.fromCode(ErrorCode.PAYMENT_PROVIDER_NOT_CONFIGURED, {
                message: 'Provedor Asaas não configurado ou não suporta cadastro de conta bancária'
            });
        }

        await this.otp.exec({
            schoolId,
            challengeId: otpChallengeId,
            purpose: 'BANK_ACCOUNT_CHANGE'
        });

        const requestedId = typeof input.bankAccountId === 'string' ? input.bankAccountId.trim() : '';
        const bankAccount = requestedId
            ? await this.bankAccounts.findById(requestedId)
            : (await this.bankAccounts.findBySchoolIdAndActive(schoolId))[0] ?? null;

        if (!bankAccount || bankAccount.schoolId !== schoolId) {
            throw AppError.fromCode(ErrorCode.VALIDATION_ERROR, {
                message: 'Conta bancária não encontrada para a escola'
            });
        }

        const bankCode = bankAccount.bankCode;
        if (bankCode == null || !Number.isFinite(bankCode)) {
            throw AppError.fromCode(ErrorCode.VALIDATION_ERROR, {
                message: 'Conta bancária precisa ter código do banco (banco) para reenviar ao Asaas'
            });
        }

        const asaas = await this.asaasProvider.createReceivingBankAccount(school.accountApiKey, {
            bankCode: String(bankCode),
            bankName: bankAccount.bankName,
            ownerName: school.name.trim() || bankAccount.bankName,
            cpfCnpjDigits: bankAccount.bankAccountHolderDocument.replace(/\D/g, ''),
            agency: bankAccount.bankAgency,
            agencyDigit: bankAccount.bankAgencyDigit,
            account: bankAccount.bankAccount,
            accountDigit: bankAccount.bankAccountDigit,
            bankAccountType: bankAccount.bankAccountType
        });

        assertSuccessfulAsaasReceivingBankAccount(asaas);

        return {
            schoolId: school.id,
            bankAccountId: bankAccount.id,
            asaas
        };
    }
}

