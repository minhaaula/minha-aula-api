import { SchoolBankAccountRepository } from '../../ports/repositories/school-bank-account.repo';
import { SchoolBankAccount } from '../../domain/entities/school-bank-account';
import type { School } from '../../domain/entities/school';
import { SchoolRepository } from '../../ports/repositories/school.repo';
import { Uuid } from '../../shared/uuid';
import { ConsumeSchoolActionOtp } from './consume-school-action-otp';
import type { AsaasProviderPort, AsaasReceivingBankAccountResult } from '../../ports/providers/asaas-port';
import { AppError, ErrorCode } from '../../shared/errors';

function digitsOnly(value: string | null | undefined): string {
    if (!value) return '';
    return value.replace(/\D/g, '');
}

/**
 * Documento do titular informado no payload, ou CNPJ da escola, ou CPF do responsável (fluxo sem CNPJ).
 */
function resolveBankAccountHolderDocument(input: string | undefined, school: School): string {
    const fromInput = digitsOnly(input);
    if (fromInput.length === 11 || fromInput.length === 14) {
        return fromInput;
    }
    const fromSchoolCnpj = digitsOnly(school.cnpj);
    if (fromSchoolCnpj.length === 14) {
        return fromSchoolCnpj;
    }
    const fromOwnerCpf = digitsOnly(school.ownerCpf);
    if (fromOwnerCpf.length === 11) {
        return fromOwnerCpf;
    }
    throw AppError.validation(
        'Informe o CPF ou CNPJ do titular da conta ou complete o CNPJ da escola ou o CPF do responsável no cadastro.'
    );
}

export function assertSuccessfulAsaasReceivingBankAccount(res: AsaasReceivingBankAccountResult): void {
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

function isAsaasBankAccountAlreadyExistsError(err: unknown): boolean {
    const msg = err instanceof Error ? err.message : String(err);
    const normalized = msg.toLowerCase();
    // AsaasClient.toDomainError() inclui "(status XXX)" no texto.
    if (normalized.includes('status 409')) return true;
    // Mensagens comuns quando já existe cadastro semelhante.
    if (normalized.includes('already exists')) return true;
    if (normalized.includes('já existe')) return true;
    if (normalized.includes('ja existe')) return true;
    if (normalized.includes('duplic')) return true;
    return false;
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
        /** Opcional: quando omitido, usa CNPJ da escola ou CPF do responsável. */
        bankAccountHolderDocument?: string;
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

        const bankAccountHolderDocument = resolveBankAccountHolderDocument(input.bankAccountHolderDocument, school);

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
            try {
                asaas = await this.asaasProvider.createReceivingBankAccount(school.accountApiKey!, {
                    bankCode: String(bankCode),
                    bankName: input.bankName,
                    ownerName: school.name.trim() || input.bankName,
                    cpfCnpjDigits: bankAccountHolderDocument,
                    agency: input.bankAgency,
                    agencyDigit: input.bankAgencyDigit,
                    account: input.bankAccount,
                    accountDigit: input.bankAccountDigit,
                    bankAccountType: input.bankAccountType
                });
                assertSuccessfulAsaasReceivingBankAccount(asaas);
            } catch (err: unknown) {
                // Se já existir no Asaas, não bloqueia criar/atualizar do nosso lado.
                if (!isAsaasBankAccountAlreadyExistsError(err)) {
                    throw err;
                }
            }
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
            bankAccountHolderDocument,
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
