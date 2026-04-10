import { describe, expect, it } from 'vitest';
import { CreateSchoolBankAccount } from '../../src/app/use-cases/create-school-bank-account';
import { UpdateSchoolBankAccount } from '../../src/app/use-cases/update-school-bank-account';
import { ListSchoolBankAccounts } from '../../src/app/use-cases/list-school-bank-accounts';
import { SchoolBankAccountRepository } from '../../src/ports/repositories/school-bank-account.repo';
import { SchoolRepository } from '../../src/ports/repositories/school.repo';
import { SchoolBankAccount } from '../../src/domain/entities/school-bank-account';
import { School } from '../../src/domain/entities/school';
import { Uuid } from '../../src/shared/uuid';

class InMemorySchoolBankAccountRepository implements SchoolBankAccountRepository {
    private readonly items = new Map<string, SchoolBankAccount>();

    async findById(id: string): Promise<SchoolBankAccount | null> {
        return this.items.get(id) ?? null;
    }

    async findBySchoolId(schoolId: string): Promise<SchoolBankAccount[]> {
        return Array.from(this.items.values())
            .filter((account) => account.schoolId === schoolId)
            .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    }

    async findBySchoolIdAndActive(schoolId: string): Promise<SchoolBankAccount[]> {
        return Array.from(this.items.values())
            .filter((account) => account.schoolId === schoolId && account.isActive)
            .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
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

    async findByEmail(_email: string): Promise<School | null> {
        return null;
    }

    async findByOwnerUserId(_userId: string): Promise<School | null> {
        return null;
    }

    async findByOwnerEmail(_email: string): Promise<School | null> {
        return null;
    }

    async findAll(): Promise<School[]> {
        return Array.from(this.items.values());
    }

    async save(school: School): Promise<void> {
        this.items.set(school.id, school);
    }

    async updateOwnerPassword(_schoolId: string, _hashedPassword: string): Promise<void> {
        // Not implemented for this test
    }

    seed(school: School) {
        this.items.set(school.id, school);
    }
}

describe('Bank Accounts - Novos campos (banco, dígito agência, dígito conta, PIX)', () => {
    it('cria uma conta bancária com todos os novos campos', async () => {
        const schoolsRepo = new InMemorySchoolRepository();
        const bankAccountsRepo = new InMemorySchoolBankAccountRepository();

        const school = School.create({
            id: Uuid(),
            name: 'Escola Teste',
            email: 'teste@escola.com',
            phone: '11999999999',
            cnpj: '12345678000190'
        });
        schoolsRepo.seed(school);

        const createAccount = new CreateSchoolBankAccount(schoolsRepo, bankAccountsRepo);

        const result = await createAccount.exec({
            schoolId: school.id,
            bankName: 'Banco do Brasil',
            bankCode: 1,
            bankAgency: '1234',
            bankAgencyDigit: '5',
            bankAccount: '12345678',
            bankAccountDigit: '9',
            bankAccountType: 'CORRENTE',
            bankAccountHolderDocument: '12345678000190',
            pixKey: 'teste@escola.com',
            otpChallengeId: Uuid()
        });

        expect(result.id).toBeTruthy();
        expect(result.bankCode).toBe(1);
        expect(result.bankAgencyDigit).toBe('5');
        expect(result.bankAccountDigit).toBe('9');
        expect(result.pixKey).toBe('teste@escola.com');
        expect(result.bankName).toBe('Banco do Brasil');
        expect(result.bankAgency).toBe('1234');
        expect(result.bankAccount).toBe('12345678');
        expect(result.bankAccountType).toBe('CORRENTE');

        const stored = await bankAccountsRepo.findById(result.id);
        expect(stored).toBeTruthy();
        expect(stored?.bankCode).toBe(1);
        expect(stored?.bankAgencyDigit).toBe('5');
        expect(stored?.bankAccountDigit).toBe('9');
        expect(stored?.pixKey).toBe('teste@escola.com');
    });

    it('cria uma conta bancária sem os novos campos opcionais', async () => {
        const schoolsRepo = new InMemorySchoolRepository();
        const bankAccountsRepo = new InMemorySchoolBankAccountRepository();

        const school = School.create({
            id: Uuid(),
            name: 'Escola Teste 2',
            email: 'teste2@escola.com',
            phone: '11999999999',
            cnpj: '12345678000191'
        });
        schoolsRepo.seed(school);

        const createAccount = new CreateSchoolBankAccount(schoolsRepo, bankAccountsRepo);

        const result = await createAccount.exec({
            schoolId: school.id,
            bankName: 'Itaú',
            bankAgency: '5678',
            bankAccount: '87654321',
            bankAccountType: 'POUPANCA',
            bankAccountHolderDocument: '12345678000191',
            otpChallengeId: Uuid()
        });

        expect(result.id).toBeTruthy();
        expect(result.bankCode).toBeUndefined();
        expect(result.bankAgencyDigit).toBeUndefined();
        expect(result.bankAccountDigit).toBeUndefined();
        expect(result.pixKey).toBeUndefined();
        expect(result.bankName).toBe('Itaú');
        expect(result.bankAgency).toBe('5678');
        expect(result.bankAccount).toBe('87654321');
    });

    it('atualiza uma conta bancária adicionando os novos campos', async () => {
        const schoolsRepo = new InMemorySchoolRepository();
        const bankAccountsRepo = new InMemorySchoolBankAccountRepository();

        const school = School.create({
            id: Uuid(),
            name: 'Escola Teste 3',
            email: 'teste3@escola.com',
            phone: '11999999999',
            cnpj: '12345678000192'
        });
        schoolsRepo.seed(school);

        const createAccount = new CreateSchoolBankAccount(schoolsRepo, bankAccountsRepo);
        const created = await createAccount.exec({
            schoolId: school.id,
            bankName: 'Bradesco',
            bankAgency: '1111',
            bankAccount: '22222222',
            bankAccountType: 'CORRENTE',
            bankAccountHolderDocument: '12345678000192',
            otpChallengeId: Uuid()
        });

        const updateAccount = new UpdateSchoolBankAccount(bankAccountsRepo);

        const updated = await updateAccount.exec({
            accountId: created.id,
            schoolId: school.id,
            bankCode: 237,
            bankAgencyDigit: 'X',
            bankAccountDigit: 'Y',
            pixKey: '12345678000192',
            otpChallengeId: Uuid()
        });

        expect(updated.bankCode).toBe(237);
        expect(updated.bankAgencyDigit).toBe('X');
        expect(updated.bankAccountDigit).toBe('Y');
        expect(updated.pixKey).toBe('12345678000192');
        expect(updated.bankName).toBe('Bradesco'); // Mantém o valor original
        expect(updated.bankAgency).toBe('1111'); // Mantém o valor original
        expect(updated.bankAccount).toBe('22222222'); // Mantém o valor original

        const stored = await bankAccountsRepo.findById(created.id);
        expect(stored?.bankCode).toBe(237);
        expect(stored?.bankAgencyDigit).toBe('X');
        expect(stored?.bankAccountDigit).toBe('Y');
        expect(stored?.pixKey).toBe('12345678000192');
    });

    it('atualiza apenas alguns campos novos mantendo os outros', async () => {
        const schoolsRepo = new InMemorySchoolRepository();
        const bankAccountsRepo = new InMemorySchoolBankAccountRepository();

        const school = School.create({
            id: Uuid(),
            name: 'Escola Teste 4',
            email: 'teste4@escola.com',
            phone: '11999999999',
            cnpj: '12345678000193'
        });
        schoolsRepo.seed(school);

        const createAccount = new CreateSchoolBankAccount(schoolsRepo, bankAccountsRepo);
        const created = await createAccount.exec({
            schoolId: school.id,
            bankName: 'Santander',
            bankCode: 33,
            bankAgency: '3333',
            bankAgencyDigit: 'A',
            bankAccount: '33333333',
            bankAccountDigit: 'B',
            bankAccountType: 'CORRENTE',
            bankAccountHolderDocument: '12345678000193',
            pixKey: 'pix-original@teste.com',
            otpChallengeId: Uuid()
        });

        const updateAccount = new UpdateSchoolBankAccount(bankAccountsRepo);

        const updated = await updateAccount.exec({
            accountId: created.id,
            schoolId: school.id,
            bankCode: 341, // Atualiza código do banco
            pixKey: 'pix-novo@teste.com', // Atualiza PIX
            otpChallengeId: Uuid()
            // Não atualiza dígitos, devem ser mantidos
        });

        expect(updated.bankCode).toBe(341);
        expect(updated.bankAgencyDigit).toBe('A'); // Mantido
        expect(updated.bankAccountDigit).toBe('B'); // Mantido
        expect(updated.pixKey).toBe('pix-novo@teste.com');
    });

    it('lista contas bancárias incluindo os novos campos', async () => {
        const schoolsRepo = new InMemorySchoolRepository();
        const bankAccountsRepo = new InMemorySchoolBankAccountRepository();

        const school = School.create({
            id: Uuid(),
            name: 'Escola Teste 5',
            email: 'teste5@escola.com',
            phone: '11999999999',
            cnpj: '12345678000194'
        });
        schoolsRepo.seed(school);

        const createAccount = new CreateSchoolBankAccount(schoolsRepo, bankAccountsRepo);

        const account1 = await createAccount.exec({
            schoolId: school.id,
            bankName: 'Banco Original',
            bankCode: 104,
            bankAgency: '4444',
            bankAgencyDigit: '1',
            bankAccount: '44444444',
            bankAccountDigit: '2',
            bankAccountType: 'CORRENTE',
            bankAccountHolderDocument: '12345678000194',
            pixKey: 'pix1@teste.com',
            otpChallengeId: Uuid()
        });

        const account2 = await createAccount.exec({
            schoolId: school.id,
            bankName: 'Banco Inter',
            bankCode: 77,
            bankAgency: '5555',
            bankAgencyDigit: '3',
            bankAccount: '55555555',
            bankAccountDigit: '4',
            bankAccountType: 'POUPANCA',
            bankAccountHolderDocument: '12345678000194',
            pixKey: 'pix2@teste.com',
            otpChallengeId: Uuid()
        });

        const listAccounts = new ListSchoolBankAccounts(bankAccountsRepo);
        const result = await listAccounts.exec({ schoolId: school.id });

        expect(result.accounts).toHaveLength(2);
        
        const found1 = result.accounts.find((acc) => acc.id === account1.id);
        expect(found1).toBeTruthy();
        expect(found1?.bankCode).toBe(104);
        expect(found1?.bankAgencyDigit).toBe('1');
        expect(found1?.bankAccountDigit).toBe('2');
        expect(found1?.pixKey).toBe('pix1@teste.com');

        const found2 = result.accounts.find((acc) => acc.id === account2.id);
        expect(found2).toBeTruthy();
        expect(found2?.bankCode).toBe(77);
        expect(found2?.bankAgencyDigit).toBe('3');
        expect(found2?.bankAccountDigit).toBe('4');
        expect(found2?.pixKey).toBe('pix2@teste.com');
    });

    it('valida que banco deve ser um número positivo', async () => {
        const schoolsRepo = new InMemorySchoolRepository();
        const bankAccountsRepo = new InMemorySchoolBankAccountRepository();

        const school = School.create({
            id: Uuid(),
            name: 'Escola Teste 6',
            email: 'teste6@escola.com',
            phone: '11999999999',
            cnpj: '12345678000195'
        });
        schoolsRepo.seed(school);

        const createAccount = new CreateSchoolBankAccount(schoolsRepo, bankAccountsRepo);

        // Testa com número negativo
        await expect(
            createAccount.exec({
                schoolId: school.id,
                bankName: 'Banco Teste',
                bankCode: -1,
                bankAgency: '6666',
                bankAccount: '66666666',
                bankAccountType: 'CORRENTE',
                bankAccountHolderDocument: '12345678000195',
                otpChallengeId: Uuid()
            })
        ).rejects.toThrow();
    });

    it('valida que dígitos não podem ter mais de 2 caracteres', async () => {
        const schoolsRepo = new InMemorySchoolRepository();
        const bankAccountsRepo = new InMemorySchoolBankAccountRepository();

        const school = School.create({
            id: Uuid(),
            name: 'Escola Teste 7',
            email: 'teste7@escola.com',
            phone: '11999999999',
            cnpj: '12345678000196'
        });
        schoolsRepo.seed(school);

        const createAccount = new CreateSchoolBankAccount(schoolsRepo, bankAccountsRepo);

        // Testa com dígito muito longo
        await expect(
            createAccount.exec({
                schoolId: school.id,
                bankName: 'Banco Teste',
                bankAgency: '7777',
                bankAgencyDigit: 'ABC', // Mais de 2 caracteres
                bankAccount: '77777777',
                bankAccountType: 'CORRENTE',
                bankAccountHolderDocument: '12345678000196',
                otpChallengeId: Uuid()
            })
        ).rejects.toThrow();
    });
});
