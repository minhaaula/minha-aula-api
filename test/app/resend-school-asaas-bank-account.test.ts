import { describe, expect, it } from 'vitest';
import type { AsaasProviderPort, AsaasReceivingBankAccountInput } from '../../src/ports/providers/asaas-port';
import type { SchoolBankAccountRepository } from '../../src/ports/repositories/school-bank-account.repo';
import type { SchoolRepository } from '../../src/ports/repositories/school.repo';
import { SchoolBankAccount } from '../../src/domain/entities/school-bank-account';
import { School } from '../../src/domain/entities/school';
import { Uuid } from '../../src/shared/uuid';
import type { ConsumeSchoolActionOtp } from '../../src/app/use-cases/consume-school-action-otp';
import { ResendSchoolAsaasBankAccount } from '../../src/app/use-cases/resend-school-asaas-bank-account';
import { AppError, ErrorCode } from '../../src/shared/errors';

class InMemorySchoolBankAccountRepository implements SchoolBankAccountRepository {
    private readonly items = new Map<string, SchoolBankAccount>();

    async findById(id: string): Promise<SchoolBankAccount | null> {
        return this.items.get(id) ?? null;
    }

    async findBySchoolId(schoolId: string): Promise<SchoolBankAccount[]> {
        return Array.from(this.items.values()).filter((a) => a.schoolId === schoolId);
    }

    async findBySchoolIdAndActive(schoolId: string): Promise<SchoolBankAccount[]> {
        return Array.from(this.items.values()).filter((a) => a.schoolId === schoolId && a.isActive);
    }

    async save(account: SchoolBankAccount): Promise<void> {
        this.items.set(account.id, account);
    }

    async delete(id: string): Promise<void> {
        this.items.delete(id);
    }

    seed(account: SchoolBankAccount) {
        this.items.set(account.id, account);
    }
}

class InMemorySchoolRepository implements SchoolRepository {
    private readonly items = new Map<string, School>();

    async findById(id: string): Promise<School | null> {
        return this.items.get(id) ?? null;
    }

    async findByEmail(): Promise<School | null> {
        return null;
    }

    async findByOwnerUserId(): Promise<School | null> {
        return null;
    }

    async findByOwnerEmail(): Promise<School | null> {
        return null;
    }

    async findAll(): Promise<School[]> {
        return Array.from(this.items.values());
    }

    async save(school: School): Promise<void> {
        this.items.set(school.id, school);
    }

    async updateOwnerPassword(): Promise<void> {}

    seed(school: School) {
        this.items.set(school.id, school);
    }
}

class FakeAsaas implements Pick<AsaasProviderPort, 'createReceivingBankAccount'> {
    lastInput: AsaasReceivingBankAccountInput | null = null;

    async createReceivingBankAccount(_accountApiKey: string, input: AsaasReceivingBankAccountInput) {
        this.lastInput = input;
        return { id: 'ba_asaas_test', object: 'bankAccount' };
    }
}

describe('ResendSchoolAsaasBankAccount', () => {
    it('reenvia a conta bancária ativa ao Asaas e repassa payload coerente', async () => {
        const schoolsRepo = new InMemorySchoolRepository();
        const bankAccountsRepo = new InMemorySchoolBankAccountRepository();
        const asaas = new FakeAsaas();

        const otp: ConsumeSchoolActionOtp = {
            async exec() {
                /* no-op */
            }
        } as unknown as ConsumeSchoolActionOtp;

        const school = School.create({
            id: Uuid(),
            name: 'Escola Integração',
            email: 'e@escola.com',
            phone: '11999999999',
            cnpj: '12345678000190',
            accountApiKey: '$aact_hmlg_test_key'
        });
        schoolsRepo.seed(school);

        const account = SchoolBankAccount.create({
            id: Uuid(),
            schoolId: school.id,
            bankName: 'Banco do Brasil',
            bankCode: 1,
            bankAgency: '1234',
            bankAgencyDigit: '0',
            bankAccount: '56789',
            bankAccountDigit: '1',
            bankAccountType: 'CORRENTE',
            bankAccountHolderDocument: '12345678000190'
        });
        bankAccountsRepo.seed(account);

        const uc = new ResendSchoolAsaasBankAccount(schoolsRepo, bankAccountsRepo, otp, asaas as unknown as AsaasProviderPort);

        const result = await uc.exec({
            schoolId: school.id,
            otpChallengeId: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'
        });

        expect(result.schoolId).toBe(school.id);
        expect(result.bankAccountId).toBe(account.id);
        expect(result.asaas).toMatchObject({ id: 'ba_asaas_test' });
        expect(asaas.lastInput).not.toBeNull();
        expect(asaas.lastInput!.bankCode).toBe('1');
        expect(asaas.lastInput!.ownerName).toBe('Escola Integração');
        expect(asaas.lastInput!.bankAccountType).toBe('CORRENTE');
    });

    it('falha se escola não tiver subconta (accountApiKey)', async () => {
        const schoolsRepo = new InMemorySchoolRepository();
        const bankAccountsRepo = new InMemorySchoolBankAccountRepository();
        const asaas = new FakeAsaas();
        const otp: ConsumeSchoolActionOtp = { async exec() {} } as unknown as ConsumeSchoolActionOtp;

        const school = School.create({
            id: Uuid(),
            name: 'Sem Asaas',
            email: 's@escola.com',
            phone: '11999999999',
            cnpj: '12345678000190'
        });
        schoolsRepo.seed(school);

        const uc = new ResendSchoolAsaasBankAccount(schoolsRepo, bankAccountsRepo, otp, asaas as unknown as AsaasProviderPort);

        await expect(
            uc.exec({
                schoolId: school.id,
                otpChallengeId: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'
            })
        ).rejects.toMatchObject({ code: ErrorCode.VALIDATION_ERROR });
    });

    it('falha se não existir conta bancária ativa', async () => {
        const schoolsRepo = new InMemorySchoolRepository();
        const bankAccountsRepo = new InMemorySchoolBankAccountRepository();
        const asaas = new FakeAsaas();
        const otp: ConsumeSchoolActionOtp = { async exec() {} } as unknown as ConsumeSchoolActionOtp;

        const school = School.create({
            id: Uuid(),
            name: 'Com Asaas',
            email: 'c@escola.com',
            phone: '11999999999',
            cnpj: '12345678000190',
            accountApiKey: 'key'
        });
        schoolsRepo.seed(school);

        const uc = new ResendSchoolAsaasBankAccount(schoolsRepo, bankAccountsRepo, otp, asaas as unknown as AsaasProviderPort);

        await expect(
            uc.exec({
                schoolId: school.id,
                otpChallengeId: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'
            })
        ).rejects.toBeInstanceOf(AppError);
    });
});

