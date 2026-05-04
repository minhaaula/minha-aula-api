import { describe, expect, it } from 'vitest';
import { GenerateTuitionPix } from '../../src/app/use-cases/generate-tuition-pix';
import { SchoolFinancialChargeRepository } from '../../src/ports/repositories/school-financial-charge.repo';
import { UserRepository } from '../../src/ports/repositories/user.repo';
import { SchoolRepository } from '../../src/ports/repositories/school.repo';
import { CourseRepository } from '../../src/ports/repositories/course.repo';
import { PaymentProviderPort, CreatePixChargeInput } from '../../src/ports/providers/payment-provider.port';
import { SchoolFinancialCharge } from '../../src/domain/entities/school-financial-charge';
import { School } from '../../src/domain/entities/school';
import { Course } from '../../src/domain/entities/course';
import { User } from '../../src/domain/entities/user';
import { Email } from '../../src/domain/value-objects/email';
import { PostalAddress } from '../../src/domain/value-objects/postal-address';
import { UserPersonaEnum } from '../../src/domain/value-objects/user-persona';
import { Money } from '../../src/domain/value-objects/money';

class InMemoryCharges implements SchoolFinancialChargeRepository {
    private readonly items = new Map<string, SchoolFinancialCharge>();
    async findById(id: string) { return this.items.get(id) ?? null; }
    async findByAsaasPaymentId(paymentId: string) {
        const needle = paymentId.trim();
        return Array.from(this.items.values()).find((c) => c.asaasPaymentId === needle) ?? null;
    }
    async save(charge: SchoolFinancialCharge) { this.items.set(charge.id, charge); }
    seed(charge: SchoolFinancialCharge) { this.items.set(charge.id, charge); }
}

class InMemoryUsers implements UserRepository {
    private readonly items = new Map<string, User>();
    async findById(id: string) { return this.items.get(id) ?? null; }
    async findByEmail() { return null; }
    async findByCpf() { return null; }
    async findByPersona() { return []; }
    async save(user: User) { this.items.set(user.id, user); }
    seed(user: User) { this.items.set(user.id, user); }
}

class InMemorySchools implements SchoolRepository {
    private readonly items = new Map<string, School>();
    async findById(id: string) { return this.items.get(id) ?? null; }
    async findByEmail() { return null; }
    async findByOwnerUserId() { return null; }
    async findAll() { return Array.from(this.items.values()); }
    async save(school: School) { this.items.set(school.id, school); }
    seed(school: School) { this.items.set(school.id, school); }
}

class InMemoryCourses implements CourseRepository {
    private readonly items = new Map<string, Course>();
    async findById(id: string) { return this.items.get(id) ?? null; }
    async findBySchoolAndName() { return null; }
    async findBySchoolId() { return []; }
    async save(course: Course) { this.items.set(course.id, course); }
    seed(course: Course) { this.items.set(course.id, course); }
}

class FakePixProvider implements PaymentProviderPort {
    public callCount = 0;
    public getPixQrCodeCalls = 0;
    public lastInput: CreatePixChargeInput | null = null;

    constructor(
        private readonly response: {
            providerRef: string;
            pixQrCode?: string;
            pixCopiaECola?: string;
            invoiceUrl?: string;
            dueDate: Date;
            /** Quando createPix não traz QR, o use case chama getPixQrCode (GET /payments/{id}/pixQrCode). */
            pixQrCodeFromGet?: { encodedImage: string; payload: string } | null;
        }
    ) {}

    async authorize() {
        throw new Error('Not implemented');
    }

    async capture() {
        throw new Error('Not implemented');
    }

    async createPixCharge(input: CreatePixChargeInput) {
        this.callCount++;
        this.lastInput = input;
        return {
            providerRef: this.response.providerRef,
            pixQrCode: this.response.pixQrCode,
            pixCopiaECola: this.response.pixCopiaECola,
            invoiceUrl: this.response.invoiceUrl,
            dueDate: this.response.dueDate
        };
    }

    async getPixQrCode(paymentId: string) {
        this.getPixQrCodeCalls += 1;
        if (this.response.pixQrCodeFromGet && paymentId === this.response.providerRef) {
            return this.response.pixQrCodeFromGet;
        }
        throw new Error('no qr');
    }
}

function makeUser(id: string): User {
    return User.create({
        id,
        fullName: 'João Silva',
        birthDate: new Date('1990-01-01'),
        email: Email.create('joao@example.com'),
        cpf: '12345678909',
        phone: '11999999999',
        persona: UserPersonaEnum.STUDENT,
        passwordHash: 'hash',
        address: PostalAddress.create({
            street: 'Rua das Flores',
            number: '123',
            complement: 'Apto 45',
            district: 'Centro',
            city: 'São Paulo',
            state: 'SP',
            zipCode: '01234567'
        })
    });
}

function makeSchool(id: string, accountId?: string, accountApiKey?: string): School {
    const school = School.create({
        id,
        ownerUserId: 'owner-1',
        name: 'Escola Teste',
        email: 'escola@teste.com',
        cnpj: '12345678000190',
        phone: '11988888888',
        addresses: [PostalAddress.create({
            street: 'Rua da Escola',
            number: '456',
            city: 'São Paulo',
            state: 'SP',
            zipCode: '01234567'
        })],
        accountId: accountId || null,
        accountApiKey: accountApiKey || null
    });

    return school;
}

function makeCourse(id: string, schoolId: string): Course {
    return Course.create({
        id,
        schoolId,
        name: 'Curso de Inglês',
        description: 'Curso básico de inglês',
        monthlyPriceCents: 35000
    });
}

describe('GenerateTuitionPix', () => {
    it('generates PIX for tuition charge and saves QR code', async () => {
        const charges = new InMemoryCharges();
        const users = new InMemoryUsers();
        const schools = new InMemorySchools();
        const courses = new InMemoryCourses();

        const user = makeUser('user-1');
        users.seed(user);

        // Não passar accountId para usar o provider fake ao invés do Asaas real
        const school = makeSchool('school-1');
        schools.seed(school);

        const course = makeCourse('course-1', school.id);
        courses.seed(course);

        const charge = SchoolFinancialCharge.create({
            id: 'charge-1',
            schoolId: school.id,
            ownerUserId: user.id,
            studentUserId: user.id,
            dependentId: null,
            courseId: course.id,
            courseClassId: 'class-1',
            chargeType: 'TUITION',
            description: 'Mensalidade - Janeiro 2024',
            amountCents: 35000,
            dueDate: new Date('2024-01-10')
        });
        charges.seed(charge);

        const provider = new FakePixProvider({
            providerRef: 'asaas-pix-123',
            pixQrCode: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
            pixCopiaECola: '00020126580014br.gov.bcb.pix0136123e4567-e12b-12cd-0000-1234567890125204000053039865802BR5913FULANO DE TAL6008BRASILIA62070503***63041D3D',
            invoiceUrl: 'https://asaas.com/invoice/123',
            dueDate: new Date('2024-01-10')
        });

        const useCase = new GenerateTuitionPix(
            charges,
            users,
            schools,
            courses,
            provider
        );

        const result = await useCase.exec({
            chargeId: charge.id,
            requester: { id: user.id, persona: UserPersonaEnum.STUDENT }
        });

        // Verificar se o PIX foi gerado
        expect(result.paymentProviderRef).toBe('asaas-pix-123');
        expect(result.pixQrCode).toBeTruthy();
        expect(result.pixCopiaECola).toBeTruthy();
        expect(result.invoiceUrl).toBe('https://asaas.com/invoice/123');
        expect(result.chargeId).toBe('charge-1');
        expect(result.amountCents).toBe(35000);
        expect(result.courseName).toBe('Curso de Inglês');
        expect(result.status).toBe('OPEN');

        // Verificar se o provider foi chamado
        expect(provider.callCount).toBe(1);
        expect(provider.lastInput).toBeTruthy();
        expect(provider.lastInput?.amount.amount).toBe(35000);
        expect(provider.lastInput?.customer.name).toBe('João Silva');
        expect(provider.lastInput?.customer.email).toBe('joao@example.com');

        // Verificar se foi salvo na mensalidade
        const stored = await charges.findById(charge.id);
        expect(stored).toBeTruthy();
        expect(stored!.asaasPaymentId).toBe('asaas-pix-123');
        expect(stored!.asaasInvoiceUrl).toBe('https://asaas.com/invoice/123');
        expect(stored!.asaasPayload).toBeTruthy();
        expect(stored!.asaasPayload?.pixQrCode).toBeTruthy();
        expect(stored!.asaasPayload?.pixCopiaECola).toBeTruthy();
        expect(stored!.status).toBe('OPEN');
    });

    it('busca QR via GET pixQrCode quando POST create não devolve imagem/copia-e-cola', async () => {
        const charges = new InMemoryCharges();
        const users = new InMemoryUsers();
        const schools = new InMemorySchools();
        const courses = new InMemoryCourses();

        const user = makeUser('user-getqr');
        users.seed(user);

        const school = makeSchool('school-getqr');
        schools.seed(school);

        const course = makeCourse('course-getqr', school.id);
        courses.seed(course);

        const charge = SchoolFinancialCharge.create({
            id: 'charge-getqr',
            schoolId: school.id,
            ownerUserId: user.id,
            studentUserId: user.id,
            dependentId: null,
            courseId: course.id,
            courseClassId: 'class-g',
            chargeType: 'TUITION',
            description: 'Mensalidade',
            amountCents: 5000,
            dueDate: new Date('2026-05-05')
        });
        charges.seed(charge);

        const provider = new FakePixProvider({
            providerRef: 'pay_sub_pix',
            invoiceUrl: 'https://www.asaas.com/i/x',
            dueDate: new Date('2026-05-05'),
            pixQrCodeFromGet: {
                encodedImage: 'base64img',
                payload: '00020126PIXpayload'
            }
        });

        const useCase = new GenerateTuitionPix(charges, users, schools, courses, provider);

        const result = await useCase.exec({
            chargeId: charge.id,
            requester: { id: user.id, persona: UserPersonaEnum.STUDENT }
        });

        expect(provider.getPixQrCodeCalls).toBeGreaterThanOrEqual(1);
        expect(result.pixQrCode).toBe('base64img');
        expect(result.pixCopiaECola).toBe('00020126PIXpayload');

        const stored = await charges.findById(charge.id);
        expect(stored?.asaasPayload?.pixQrCode).toBe('base64img');
        expect(stored?.asaasPayload?.pixCopiaECola).toBe('00020126PIXpayload');
    });

    it('returns amountCents (bruto) distinct from netAmountCents when there is discount', async () => {
        const charges = new InMemoryCharges();
        const users = new InMemoryUsers();
        const schools = new InMemorySchools();
        const courses = new InMemoryCourses();

        const user = makeUser('user-discount');
        users.seed(user);

        const school = makeSchool('school-discount');
        schools.seed(school);

        const course = makeCourse('course-discount', school.id);
        courses.seed(course);

        const charge = SchoolFinancialCharge.create({
            id: 'charge-discount',
            schoolId: school.id,
            ownerUserId: user.id,
            studentUserId: user.id,
            dependentId: null,
            courseId: course.id,
            courseClassId: 'class-d',
            chargeType: 'TUITION',
            amountCents: 100_000,
            discountCents: 10_000,
            discountReason: 'Bolsa',
            dueDate: new Date('2024-03-10')
        });
        charges.seed(charge);

        const provider = new FakePixProvider({
            providerRef: 'asaas-pix-disc',
            pixQrCode: 'qr',
            pixCopiaECola: 'pix',
            invoiceUrl: 'https://asaas.com/inv',
            dueDate: new Date('2024-03-10')
        });

        const useCase = new GenerateTuitionPix(
            charges,
            users,
            schools,
            courses,
            provider
        );

        const result = await useCase.exec({
            chargeId: charge.id,
            requester: { id: user.id, persona: UserPersonaEnum.STUDENT }
        });

        expect(result.amountCents).toBe(100_000);
        expect(result.discountCents).toBe(10_000);
        expect(result.netAmountCents).toBe(90_000);
        expect(provider.lastInput?.amount.amount).toBe(90_000);
    });

    it('returns existing PIX when already generated', async () => {
        const charges = new InMemoryCharges();
        const users = new InMemoryUsers();
        const schools = new InMemorySchools();
        const courses = new InMemoryCourses();

        const user = makeUser('user-2');
        users.seed(user);

        const school = makeSchool('school-2');
        schools.seed(school);

        const course = makeCourse('course-2', school.id);
        courses.seed(course);

        const charge = SchoolFinancialCharge.create({
            id: 'charge-2',
            schoolId: school.id,
            ownerUserId: user.id,
            studentUserId: user.id,
            dependentId: null,
            courseId: course.id,
            courseClassId: 'class-2',
            chargeType: 'TUITION',
            amountCents: 40000,
            dueDate: new Date('2024-02-10')
        });

        // Simular PIX já gerado
        charge.markAsSynced({
            paymentId: 'asaas-existing-pix',
            invoiceUrl: 'https://asaas.com/invoice/existing',
            payload: {
                pixQrCode: 'existing-qr-code',
                pixCopiaECola: 'existing-copia-cola',
                dueDate: new Date('2024-02-10').toISOString()
            }
        });
        charges.seed(charge);

        const provider = new FakePixProvider({
            providerRef: 'asaas-new-pix',
            dueDate: new Date('2024-02-10')
        });

        const useCase = new GenerateTuitionPix(
            charges,
            users,
            schools,
            courses,
            provider
        );

        const result = await useCase.exec({
            chargeId: charge.id,
            requester: { id: user.id, persona: UserPersonaEnum.STUDENT }
        });

        // Deve retornar o PIX existente
        expect(result.paymentProviderRef).toBe('asaas-existing-pix');
        expect(result.pixQrCode).toBe('existing-qr-code');
        expect(result.pixCopiaECola).toBe('existing-copia-cola');

        // Provider não deve ser chamado novamente
        expect(provider.callCount).toBe(0);
    });

    it('validates requester permissions', async () => {
        const charges = new InMemoryCharges();
        const users = new InMemoryUsers();
        const schools = new InMemorySchools();
        const courses = new InMemoryCourses();

        const owner = makeUser('owner-user');
        const other = makeUser('other-user');
        users.seed(owner);
        users.seed(other);

        const school = makeSchool('school-3');
        schools.seed(school);

        const course = makeCourse('course-3', school.id);
        courses.seed(course);

        const charge = SchoolFinancialCharge.create({
            id: 'charge-3',
            schoolId: school.id,
            ownerUserId: owner.id,
            studentUserId: owner.id,
            dependentId: null,
            courseId: course.id,
            courseClassId: 'class-3',
            chargeType: 'TUITION',
            amountCents: 30000,
            dueDate: new Date('2024-03-10')
        });
        charges.seed(charge);

        const provider = new FakePixProvider({
            providerRef: 'asaas-pix',
            dueDate: new Date('2024-03-10')
        });

        const useCase = new GenerateTuitionPix(
            charges,
            users,
            schools,
            courses,
            provider
        );

        // Tentar gerar PIX com outro usuário
        await expect(
            useCase.exec({
                chargeId: charge.id,
                requester: { id: other.id, persona: UserPersonaEnum.STUDENT }
            })
        ).rejects.toThrow('User not allowed to generate PIX for this charge');
    });

    it('validates charge type is TUITION', async () => {
        const charges = new InMemoryCharges();
        const users = new InMemoryUsers();
        const schools = new InMemorySchools();
        const courses = new InMemoryCourses();

        const user = makeUser('user-4');
        users.seed(user);

        const school = makeSchool('school-4');
        schools.seed(school);

        const course = makeCourse('course-4', school.id);
        courses.seed(course);

        const charge = SchoolFinancialCharge.create({
            id: 'charge-4',
            schoolId: school.id,
            ownerUserId: user.id,
            studentUserId: user.id,
            dependentId: null,
            courseId: course.id,
            courseClassId: 'class-4',
            chargeType: 'MATERIALS', // Tipo não permitido para PIX (apenas TUITION e ENROLLMENT)
            amountCents: 15000,
            dueDate: new Date('2024-04-10')
        });
        charges.seed(charge);

        const provider = new FakePixProvider({
            providerRef: 'asaas-pix',
            dueDate: new Date('2024-04-10')
        });

        const useCase = new GenerateTuitionPix(
            charges,
            users,
            schools,
            courses,
            provider
        );

        await expect(
            useCase.exec({
                chargeId: charge.id,
                requester: { id: user.id, persona: UserPersonaEnum.STUDENT }
            })
        ).rejects.toThrow(/Charge type MATERIALS does not allow PIX generation/);
    });

    it('generates PIX for ENROLLMENT charge (matrícula)', async () => {
        const charges = new InMemoryCharges();
        const users = new InMemoryUsers();
        const schools = new InMemorySchools();
        const courses = new InMemoryCourses();

        const user = makeUser('user-enroll');
        users.seed(user);

        const school = makeSchool('school-enroll');
        schools.seed(school);

        const course = makeCourse('course-enroll', school.id);
        courses.seed(course);

        const charge = SchoolFinancialCharge.create({
            id: 'charge-enroll',
            schoolId: school.id,
            ownerUserId: user.id,
            studentUserId: user.id,
            dependentId: null,
            courseId: course.id,
            courseClassId: null,
            chargeType: 'ENROLLMENT',
            amountCents: 20000,
            dueDate: new Date('2024-05-15')
        });
        charges.seed(charge);

        const provider = new FakePixProvider({
            providerRef: 'asaas-pix-enroll',
            pixQrCode: 'qr-enroll',
            pixCopiaECola: 'pix-enroll',
            dueDate: new Date('2024-05-15')
        });

        const useCase = new GenerateTuitionPix(
            charges,
            users,
            schools,
            courses,
            provider
        );

        const result = await useCase.exec({
            chargeId: charge.id,
            requester: { id: user.id, persona: UserPersonaEnum.STUDENT }
        });

        expect(result.chargeId).toBe('charge-enroll');
        expect(result.paymentProviderRef).toBe('asaas-pix-enroll');
        expect(result.pixCopiaECola).toBe('pix-enroll');
        expect(result.netAmountCents).toBe(20000);
        expect(result.courseName).toBe('Curso de Inglês');
    });

    it('validates charge status allows PIX generation', async () => {
        const charges = new InMemoryCharges();
        const users = new InMemoryUsers();
        const schools = new InMemorySchools();
        const courses = new InMemoryCourses();

        const user = makeUser('user-5');
        users.seed(user);

        const school = makeSchool('school-5');
        schools.seed(school);

        const course = makeCourse('course-5', school.id);
        courses.seed(course);

        const charge = SchoolFinancialCharge.create({
            id: 'charge-5',
            schoolId: school.id,
            ownerUserId: user.id,
            studentUserId: user.id,
            dependentId: null,
            courseId: course.id,
            courseClassId: 'class-5',
            chargeType: 'TUITION',
            amountCents: 35000,
            dueDate: new Date('2024-05-10')
        });

        // Simular status PAID (não permite gerar PIX)
        const restored = SchoolFinancialCharge.restore({
            id: charge.id,
            schoolId: charge.schoolId,
            ownerUserId: charge.ownerUserId,
            studentUserId: charge.studentUserId,
            dependentId: charge.dependentId,
            courseId: charge.courseId,
            courseClassId: charge.courseClassId,
            chargeType: charge.chargeType,
            description: charge.description,
            amountCents: charge.amountCents,
            discountCents: charge.discountCents,
            discountReason: charge.discountReason,
            netAmountCents: charge.netAmountCents,
            dueDate: charge.dueDate,
            status: 'PAID',
            asaasPaymentId: null,
            asaasInvoiceUrl: null,
            asaasPayload: null,
            paidAt: new Date(),
            paidObservation: null,
            cancelledAt: null,
            createdAt: charge.createdAt,
            updatedAt: charge.updatedAt
        });
        charges.seed(restored);

        const provider = new FakePixProvider({
            providerRef: 'asaas-pix',
            dueDate: new Date('2024-05-10')
        });

        const useCase = new GenerateTuitionPix(
            charges,
            users,
            schools,
            courses,
            provider
        );

        await expect(
            useCase.exec({
                chargeId: charge.id,
                requester: { id: user.id, persona: UserPersonaEnum.STUDENT }
            })
        ).rejects.toThrow('does not allow PIX generation');
    });

    it('permite escola gerar PIX quando schoolId do requester coincide com a cobrança', async () => {
        const charges = new InMemoryCharges();
        const users = new InMemoryUsers();
        const schools = new InMemorySchools();
        const courses = new InMemoryCourses();

        const user = makeUser('user-school-pix');
        users.seed(user);

        const school = makeSchool('school-pix-escola');
        schools.seed(school);

        const course = makeCourse('course-school-pix', school.id);
        courses.seed(course);

        const charge = SchoolFinancialCharge.create({
            id: 'charge-school-pix',
            schoolId: school.id,
            ownerUserId: user.id,
            studentUserId: user.id,
            dependentId: null,
            courseId: course.id,
            courseClassId: null,
            chargeType: 'TUITION',
            amountCents: 10000,
            dueDate: new Date('2024-06-01')
        });
        charges.seed(charge);

        const provider = new FakePixProvider({
            providerRef: 'asaas-pix-school',
            pixQrCode: 'qr-school',
            pixCopiaECola: 'pix-school-payload',
            dueDate: new Date('2024-06-01')
        });

        const useCase = new GenerateTuitionPix(charges, users, schools, courses, provider);

        const result = await useCase.exec({
            chargeId: charge.id,
            requester: {
                id: 'token-sub-escola',
                persona: UserPersonaEnum.SCHOOL,
                schoolId: school.id
            }
        });

        expect(result.paymentProviderRef).toBe('asaas-pix-school');
        expect(result.pixCopiaECola).toBe('pix-school-payload');
        expect(provider.callCount).toBe(1);
    });

    it('rejeita escola quando schoolId do requester não coincide com a cobrança', async () => {
        const charges = new InMemoryCharges();
        const users = new InMemoryUsers();
        const schools = new InMemorySchools();
        const courses = new InMemoryCourses();

        const user = makeUser('user-outra-escola');
        users.seed(user);

        const schoolA = makeSchool('school-a');
        const schoolB = makeSchool('school-b');
        schools.seed(schoolA);
        schools.seed(schoolB);

        const course = makeCourse('course-a', schoolA.id);
        courses.seed(course);

        const charge = SchoolFinancialCharge.create({
            id: 'charge-outra-escola',
            schoolId: schoolA.id,
            ownerUserId: user.id,
            studentUserId: user.id,
            dependentId: null,
            courseId: course.id,
            courseClassId: null,
            chargeType: 'TUITION',
            amountCents: 5000,
            dueDate: new Date('2024-07-01')
        });
        charges.seed(charge);

        const provider = new FakePixProvider({
            providerRef: 'asaas-should-not-call',
            dueDate: new Date('2024-07-01')
        });

        const useCase = new GenerateTuitionPix(charges, users, schools, courses, provider);

        await expect(
            useCase.exec({
                chargeId: charge.id,
                requester: {
                    id: 'token-sub',
                    persona: UserPersonaEnum.SCHOOL,
                    schoolId: schoolB.id
                }
            })
        ).rejects.toThrow('User not allowed to generate PIX for this charge');

        expect(provider.callCount).toBe(0);
    });
});

