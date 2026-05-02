import { SchoolBankAccountRepository } from '../../ports/repositories/school-bank-account.repo';
import { SchoolBankAccount } from '../../domain/entities/school-bank-account';
import { SchoolRepository } from '../../ports/repositories/school.repo';
import { Uuid } from '../../shared/uuid';
import { ConsumeSchoolActionOtp } from './consume-school-action-otp';
import type { AsaasProviderPort, AsaasReceivingBankAccountResult } from '../../ports/providers/asaas-port';
import { AppError, ErrorCode } from '../../shared/errors';

function assertSuccessfulAsaasReceivingBankAccount(res: AsaasReceivingBankAccountResult): void {
    const id = res.id;
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

export type CreateSchoolBankAccountOutput = {
    id: string;
    schoolId: string;
    bankName: string;
    bankCode?: number;
    bankAgency: string;
    bankAgencyDigit?: string;
    bankAccount: string;
    bankAccountDigit?: string;
    bankAccountType: 'CORRENTE' | 'POUPANCA';
    bankAccountHolderDocument: string;
    pixKey?: string;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
    /** Presente quando a conta foi enviada ao Asaas (subconta com API key + `banco` + provedor). */
    asaas?: AsaasReceivingBankAccountResult;
};

export class CreateSchoolBankAccount {
    constructor(
        private readonly schools: SchoolRepository,
        private readonly bankAccounts: SchoolBankAccountRepository,
        private readonly otp?: ConsumeSchoolActionOtp,
        private readonly asaasProvider?: AsaasProviderPort
    ) {}

    async exec(input: {
        schoolId: string;
        bankName: string;
        bankCode?: number;
        bankAgency: string;
        bankAgencyDigit?: string;
        bankAccount: string;
        bankAccountDigit?: string;
        bankAccountType: 'CORRENTE' | 'POUPANCA';
        bankAccountHolderDocument: string;
        pixKey?: string;
        otpChallengeId: string;
    }): Promise<CreateSchoolBankAccountOutput> {
        const schoolId = input.schoolId.trim();
        if (!schoolId) {
            throw new Error('School id is required');
        }

        const otpChallengeId = input.otpChallengeId.trim();
        if (!otpChallengeId) {
            throw new Error('OTP challenge id is required');
        }

        const school = await this.schools.findById(schoolId);
        if (!school) {
            throw new Error('School not found');
        }

        await this.otp?.exec({
            schoolId,
            challengeId: otpChallengeId,
            purpose: 'BANK_ACCOUNT_CHANGE'
        });

        const bankCode = input.bankCode;
        const hasBankCode = bankCode != null && Number.isFinite(bankCode);
        const hasSubaccountKey = Boolean(school.accountApiKey?.trim());
        const wantsAsaasSync = hasBankCode && hasSubaccountKey;

        let asaas: AsaasReceivingBankAccountResult | undefined;
        if (wantsAsaasSync) {
            if (!this.asaasProvider?.createReceivingBankAccount) {
                throw AppError.fromCode(ErrorCode.PAYMENT_PROVIDER_NOT_CONFIGURED, {
                    message: 'Provedor Asaas não configurado ou não suporta cadastro de conta bancária'
                });
            }
            asaas = await this.asaasProvider.createReceivingBankAccount(school.accountApiKey!, {
                bankCode: String(bankCode),
                bankName: input.bankName,
                ownerName: school.name.trim() || input.bankName,
                cpfCnpjDigits: input.bankAccountHolderDocument.replace(/\D/g, ''),
                agency: input.bankAgency,
                agencyDigit: input.bankAgencyDigit,
                account: input.bankAccount,
                accountDigit: input.bankAccountDigit,
                bankAccountType: input.bankAccountType
            });
            assertSuccessfulAsaasReceivingBankAccount(asaas);
        }

        const account = SchoolBankAccount.create({
            id: Uuid(),
            schoolId,
            bankName: input.bankName,
            bankCode: input.bankCode,
            bankAgency: input.bankAgency,
            bankAgencyDigit: input.bankAgencyDigit,
            bankAccount: input.bankAccount,
            bankAccountDigit: input.bankAccountDigit,
            bankAccountType: input.bankAccountType,
            bankAccountHolderDocument: input.bankAccountHolderDocument,
            pixKey: input.pixKey
        });

        await this.bankAccounts.save(account);

        const base: CreateSchoolBankAccountOutput = {
            id: account.id,
            schoolId: account.schoolId,
            bankName: account.bankName,
            bankCode: account.bankCode,
            bankAgency: account.bankAgency,
            bankAgencyDigit: account.bankAgencyDigit,
            bankAccount: account.bankAccount,
            bankAccountDigit: account.bankAccountDigit,
            bankAccountType: account.bankAccountType,
            bankAccountHolderDocument: account.bankAccountHolderDocument,
            pixKey: account.pixKey,
            isActive: account.isActive,
            createdAt: account.createdAt,
            updatedAt: account.updatedAt
        };
        if (asaas !== undefined) {
            base.asaas = asaas;
        }
        return base;
    }
}
