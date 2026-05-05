import { describe, expect, it } from 'vitest';
import { CreateSchoolBankAccount } from '../../src/app/use-cases/create-school-bank-account';
import type { AsaasProviderPort, AsaasReceivingBankAccountInput } from '../../src/ports/providers/asaas-port';
import { SchoolBankAccountRepository } from '../../src/ports/repositories/school-bank-account.repo';
import { SchoolRepository } from '../../src/ports/repositories/school.repo';
import { SchoolBankAccount } from '../../src/domain/entities/school-bank-account';
import { School } from '../../src/domain/entities/school';
import { Uuid } from '../../src/shared/uuid';
import { ConsumeSchoolActionOtp } from '../../src/app/use-cases/consume-school-action-otp';
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

/** Simula provedor que “responde” sem id (não deve persistir conta local). */
class FakeAsaasInvalidBody implements Pick<AsaasProviderPort, 'createReceivingBankAccount'> {
    async createReceivingBankAccount(): Promise<Record<string, unknown>> {
        return {};
    }
}

class FakeAsaasThrows implements Pick<AsaasProviderPort, 'createReceivingBankAccount'> {
    async createReceivingBankAccount(): Promise<Record<string, unknown>> {
        throw new Error('Asaas indisponível');
    }
}

describe('CreateSchoolBankAccount (integração Asaas)', () => {
    it('com subconta + banco + provedor: envia ao Asaas, persiste local e repassa payload coerente', async () => {
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

        const uc = new CreateSchoolBankAccount(schoolsRepo, bankAccountsRepo, otp, asaas as unknown as AsaasProviderPort);

        const result = await uc.exec({
            schoolId: school.id,
            bankName: 'Banco do Brasil',
            bankCode: 1,
            bankAgency: '1234',
            bankAgencyDigit: '0',
            bankAccount: '56789',
            bankAccountDigit: '1',
            bankAccountType: 'CORRENTE',
            bankAccountHolderDocument: '12345678000190',
            otpChallengeId: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'
        });

        expect(result.bankName).toBe('Banco do Brasil');
        expect(result.asaas).toMatchObject({ id: 'ba_asaas_test' });
        const saved = await bankAccountsRepo.findBySchoolId(school.id);
        expect(saved).toHaveLength(1);
        expect(saved[0].bankAgency).toBe('1234');

        expect(asaas.lastInput).not.toBeNull();
        expect(asaas.lastInput!.bankCode).toBe('1');
        expect(asaas.lastInput!.ownerName).toBe('Escola Integração');
        expect(asaas.lastInput!.bankAccountType).toBe('CORRENTE');
    });

    it('sem API key da subconta: só persiste localmente mesmo com banco e provedor', async () => {
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
            name: 'Sem Asaas',
            email: 's@escola.com',
            phone: '11999999999',
            cnpj: '12345678000190'
        });
        schoolsRepo.seed(school);

        const uc = new CreateSchoolBankAccount(schoolsRepo, bankAccountsRepo, otp, asaas as unknown as AsaasProviderPort);

        const result = await uc.exec({
            schoolId: school.id,
            bankName: 'BB',
            bankCode: 1,
            bankAgency: '1',
            bankAccount: '1',
            bankAccountType: 'CORRENTE',
            bankAccountHolderDocument: '12345678000190',
            otpChallengeId: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'
        });

        expect(result.asaas).toBeUndefined();
        expect(asaas.lastInput).toBeNull();
        expect(await bankAccountsRepo.findBySchoolId(school.id)).toHaveLength(1);
    });

    it('falha quando há subconta + banco mas provedor não implementa createReceivingBankAccount', async () => {
        const schoolsRepo = new InMemorySchoolRepository();
        const bankAccountsRepo = new InMemorySchoolBankAccountRepository();

        const school = School.create({
            id: Uuid(),
            name: 'X',
            email: 'x@escola.com',
            phone: '11999999999',
            cnpj: '12345678000190',
            accountApiKey: 'key'
        });
        schoolsRepo.seed(school);

        const otp: ConsumeSchoolActionOtp = {
            async exec() {
                /* no-op */
            }
        } as unknown as ConsumeSchoolActionOtp;

        const uc = new CreateSchoolBankAccount(schoolsRepo, bankAccountsRepo, otp, undefined);

        try {
            await uc.exec({
                schoolId: school.id,
                bankName: 'BB',
                bankCode: 1,
                bankAgency: '1',
                bankAccount: '1',
                bankAccountType: 'CORRENTE',
                bankAccountHolderDocument: '12345678000190',
                otpChallengeId: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'
            });
            expect.fail('deveria lançar');
        } catch (e) {
            expect(e).toBeInstanceOf(AppError);
            expect((e as AppError).code).toBe(ErrorCode.PAYMENT_PROVIDER_NOT_CONFIGURED);
        }

        expect(await bankAccountsRepo.findBySchoolId(school.id)).toHaveLength(0);
    });

    it('resposta Asaas sem id: não persiste conta', async () => {
        const schoolsRepo = new InMemorySchoolRepository();
        const bankAccountsRepo = new InMemorySchoolBankAccountRepository();
        const otp: ConsumeSchoolActionOtp = {
            async exec() {
                /* no-op */
            }
        } as unknown as ConsumeSchoolActionOtp;

        const school = School.create({
            id: Uuid(),
            name: 'Y',
            email: 'y@escola.com',
            phone: '11999999999',
            cnpj: '12345678000190',
            accountApiKey: 'key'
        });
        schoolsRepo.seed(school);

        const uc = new CreateSchoolBankAccount(
            schoolsRepo,
            bankAccountsRepo,
            otp,
            new FakeAsaasInvalidBody() as unknown as AsaasProviderPort
        );

        await expect(
            uc.exec({
                schoolId: school.id,
                bankName: 'BB',
                bankCode: 1,
                bankAgency: '1',
                bankAccount: '1',
                bankAccountType: 'CORRENTE',
                bankAccountHolderDocument: '12345678000190',
                otpChallengeId: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'
            })
        ).rejects.toMatchObject({ code: ErrorCode.EXTERNAL_SERVICE_ERROR });

        expect(await bankAccountsRepo.findBySchoolId(school.id)).toHaveLength(0);
    });

    it('Asaas lança erro: não persiste conta', async () => {
        const schoolsRepo = new InMemorySchoolRepository();
        const bankAccountsRepo = new InMemorySchoolBankAccountRepository();
        const otp: ConsumeSchoolActionOtp = {
            async exec() {
                /* no-op */
            }
        } as unknown as ConsumeSchoolActionOtp;

        const school = School.create({
            id: Uuid(),
            name: 'Z',
            email: 'z@escola.com',
            phone: '11999999999',
            cnpj: '12345678000190',
            accountApiKey: 'key'
        });
        schoolsRepo.seed(school);

        const uc = new CreateSchoolBankAccount(
            schoolsRepo,
            bankAccountsRepo,
            otp,
            new FakeAsaasThrows() as unknown as AsaasProviderPort
        );

        await expect(
            uc.exec({
                schoolId: school.id,
                bankName: 'BB',
                bankCode: 1,
                bankAgency: '1',
                bankAccount: '1',
                bankAccountType: 'CORRENTE',
                bankAccountHolderDocument: '12345678000190',
                otpChallengeId: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'
            })
        ).rejects.toThrow(/Asaas indisponível/);

        expect(await bankAccountsRepo.findBySchoolId(school.id)).toHaveLength(0);
    });

    it('se o Asaas indicar que a conta já existe: persiste localmente mesmo assim', async () => {
        const schoolsRepo = new InMemorySchoolRepository();
        const bankAccountsRepo = new InMemorySchoolBankAccountRepository();
        const otp: ConsumeSchoolActionOtp = {
            async exec() {
                /* no-op */
            }
        } as unknown as ConsumeSchoolActionOtp;

        const school = School.create({
            id: Uuid(),
            name: 'Já existe',
            email: 'ja@escola.com',
            phone: '11999999999',
            cnpj: '12345678000190',
            accountApiKey: 'key'
        });
        schoolsRepo.seed(school);

        class FakeAsaasAlreadyExists implements Pick<AsaasProviderPort, 'createReceivingBankAccount'> {
            async createReceivingBankAccount(): Promise<Record<string, unknown>> {
                throw new Error('Asaas request failed (status 409): Bank account already exists');
            }
        }

        const uc = new CreateSchoolBankAccount(
            schoolsRepo,
            bankAccountsRepo,
            otp,
            new FakeAsaasAlreadyExists() as unknown as AsaasProviderPort
        );

        const result = await uc.exec({
            schoolId: school.id,
            bankName: 'BB',
            bankCode: 1,
            bankAgency: '1',
            bankAccount: '1',
            bankAccountType: 'CORRENTE',
            bankAccountHolderDocument: '12345678000190',
            otpChallengeId: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'
        });

        expect(result.id).toBeTruthy();
        expect(result.asaas).toBeUndefined();
        expect(await bankAccountsRepo.findBySchoolId(school.id)).toHaveLength(1);
    });

    it('sem documento no payload: usa CPF do responsável quando a escola não tem CNPJ', async () => {
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
            name: 'Escola PF',
            email: 'pf@escola.com',
            phone: '11999999999',
            ownerCpf: '52998224725',
            accountApiKey: '$aact_hmlg_test_key'
        });
        schoolsRepo.seed(school);

        const uc = new CreateSchoolBankAccount(schoolsRepo, bankAccountsRepo, otp, asaas as unknown as AsaasProviderPort);

        const result = await uc.exec({
            schoolId: school.id,
            bankName: 'Banco do Brasil',
            bankCode: 1,
            bankAgency: '1234',
            bankAccount: '56789',
            bankAccountType: 'CORRENTE',
            otpChallengeId: 'bbbbbbbb-bbbb-bbbb-bbbb-eeeeeeeeeeee'
        });

        expect(result.bankAccountHolderDocument).toBe('52998224725');
        expect(asaas.lastInput).not.toBeNull();
        expect(asaas.lastInput!.cpfCnpjDigits).toBe('52998224725');
    });

    it('sem documento no payload e sem CNPJ/CPF no perfil: rejeita com validação', async () => {
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
            name: 'Incompleta',
            email: 'inc@escola.com',
            phone: '11999999999'
        });
        schoolsRepo.seed(school);

        const uc = new CreateSchoolBankAccount(schoolsRepo, bankAccountsRepo, otp, asaas as unknown as AsaasProviderPort);

        await expect(
            uc.exec({
                schoolId: school.id,
                bankName: 'BB',
                bankCode: 1,
                bankAgency: '1',
                bankAccount: '1',
                bankAccountType: 'CORRENTE',
                otpChallengeId: 'cccccccc-cccc-cccc-cccc-cccccccccccc'
            })
        ).rejects.toMatchObject({ code: ErrorCode.VALIDATION_ERROR });

        expect(asaas.lastInput).toBeNull();
    });
});
