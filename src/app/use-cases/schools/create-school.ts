import { SchoolRepository } from '../../../ports/repositories/school.repo';
import { UserRepository } from '../../../ports/repositories/user.repo';
import { School } from '../../../domain/entities/school';
import { User } from '../../../domain/entities/user';
import { Uuid } from '../../../shared/uuid';
import { Email } from '../../../domain/value-objects/email';
import { PostalAddress, type PostalAddressProps } from '../../../domain/value-objects/postal-address';
import { PasswordHasherPort } from '../../../ports/providers/password-hasher.port';
import { OutboxRepository } from '../../../ports/repositories/outbox.repo';
import { UserPersonaEnum } from '../../../domain/value-objects/user-persona';
import { AppError, ErrorCode } from '../../../shared/errors';
import type { CreateSchoolInput, CreateSchoolOutput } from '../../types/school.types';
import type { TokenProviderPort } from '../../../ports/providers/token-provider.port';
import { toE164Brazil } from '../../../shared/phone-e164';

/** Data de nascimento padrão para o usuário dono quando não é informada (User exige birthDate). */
const DEFAULT_OWNER_BIRTH_DATE = new Date('1980-01-01');

function parseIsoDateOnly(value: string | null | undefined): Date | null {
    if (value == null || value === '') return null;
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value).trim());
    if (!m) return null;
    const y = Number(m[1]);
    const mo = Number(m[2]);
    const d = Number(m[3]);
    const dt = new Date(Date.UTC(y, mo - 1, d));
    if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return null;
    return dt;
}

export class CreateSchool {
    constructor(
        private readonly schools: SchoolRepository,
        private readonly passwordHasher: PasswordHasherPort,
        private readonly users?: UserRepository,
        private readonly outbox?: OutboxRepository,
        private readonly frontendBaseUrl?: string,
        private readonly tokens?: TokenProviderPort
    ) {}

    async exec(input: CreateSchoolInput): Promise<CreateSchoolOutput> {
        const e164 = toE164Brazil(input.ownerWhatsapp ?? '');
        if (!e164) {
            throw AppError.fromCode(ErrorCode.INVALID_PHONE, { phone: input.ownerWhatsapp });
        }
        if (!this.tokens) {
            throw AppError.fromCode(ErrorCode.CONFIGURATION_ERROR, { message: 'Validação de OTP não está disponível no servidor' });
        }
        try {
            const payload = await this.tokens.verify<{ typ?: unknown; ph?: unknown }>(input.ownerWhatsappVerificationToken);
            const typ = typeof payload?.typ === 'string' ? payload.typ : '';
            const ph = typeof payload?.ph === 'string' ? payload.ph : '';
            if (typ !== 'school_signup_phone' || ph !== e164) {
                throw AppError.fromCode(ErrorCode.SCHOOL_SIGNUP_PHONE_NOT_VERIFIED);
            }
        } catch (e) {
            if (e instanceof AppError) throw e;
            throw AppError.fromCode(ErrorCode.SCHOOL_SIGNUP_PHONE_NOT_VERIFIED);
        }

        // Evitar escolas duplicadas: e-mail e CNPJ devem ser únicos.
        const emailNorm = input.email.trim().toLowerCase();
        if (this.schools.findByEmail) {
            const existingByEmail = await this.schools.findByEmail(emailNorm);
            if (existingByEmail) {
                throw AppError.fromCode(ErrorCode.BUSINESS_RULE_VIOLATION, {
                    message: 'Já existe uma escola cadastrada com este e-mail.'
                });
            }
        }
        const cnpjDigits = (input.cnpj ?? '').replace(/\D/g, '');
        if (cnpjDigits.length === 14 && this.schools.findByCnpj) {
            const existingByCnpj = await this.schools.findByCnpj(cnpjDigits);
            if (existingByCnpj) {
                throw AppError.fromCode(ErrorCode.BUSINESS_RULE_VIOLATION, {
                    message: 'Já existe uma escola cadastrada com este CNPJ.'
                });
            }
        }

        const addresses = (input.addresses ?? []).map((address) => PostalAddress.create({
            street: address.street,
            number: address.number,
            complement: address.complement ?? null,
            district: address.district ?? null,
            city: address.city,
            state: address.state,
            zipCode: address.zipCode
        }));

        const ownerFieldsProvided = [input.ownerName, input.ownerCpf, input.ownerEmail, input.ownerPassword]
            .some((value) => value !== undefined && value !== null);
        if (ownerFieldsProvided) {
            const { AppError, ErrorCode } = await import('../../../shared/errors.js');
            if (!input.ownerName || !input.ownerCpf || !input.ownerEmail || !input.ownerPassword) {
                throw AppError.fromCode(ErrorCode.INCOMPLETE_DATA, { message: 'School owner information is incomplete' });
            }
        }

        const ownerPasswordHash = input.ownerPassword
            ? await this.passwordHasher.hash(input.ownerPassword)
            : null;

        let ownerUserId: string | null = input.ownerUserId ?? null;

        // Se temos dados do dono mas não temos ownerUserId, criar usuário (persona SCHOOL) e vincular.
        // Assim a escola passa a ter owner_user_id e o dono pode ser referenciado em outros fluxos.
        if (!ownerUserId && ownerPasswordHash && input.ownerName && input.ownerCpf && input.ownerEmail && this.users && addresses.length > 0) {
            const ownerEmailNorm = input.ownerEmail.trim().toLowerCase();
            const ownerCpfDigits = input.ownerCpf.replace(/\D/g, '');
            const existingByEmail = await this.users.findByEmail(ownerEmailNorm);
            const existingByCpf = ownerCpfDigits.length === 11 ? await this.users.findByCpf(ownerCpfDigits) : null;
            const existingOwner = existingByEmail ?? existingByCpf;
            if (existingOwner) {
                ownerUserId = existingOwner.id;
                existingOwner.applyStudentAccessEnabled(true);
                existingOwner.setPasswordHash(ownerPasswordHash);
                await this.users.save(existingOwner);
            } else {
                const ownerId = Uuid();
                const mainAddress = addresses[0];
                const ownerAddress = PostalAddress.create({
                    street: mainAddress.street,
                    number: mainAddress.number,
                    complement: mainAddress.complement ?? null,
                    district: mainAddress.district ?? null,
                    city: mainAddress.city,
                    state: mainAddress.state,
                    zipCode: mainAddress.zipCode
                });
                const ownerBirthForUser = parseIsoDateOnly(input.ownerBirthDate) ?? DEFAULT_OWNER_BIRTH_DATE;
                const ownerUser = User.create({
                    id: ownerId,
                    fullName: input.ownerName.trim(),
                    birthDate: ownerBirthForUser,
                    email: Email.create(input.ownerEmail),
                    phone: input.phone,
                    cpf: ownerCpfDigits,
                    address: ownerAddress,
                    persona: UserPersonaEnum.SCHOOL,
                    passwordHash: ownerPasswordHash,
                    studentAccessEnabled: true
                });
                await this.users.save(ownerUser);
                ownerUserId = ownerId;
            }
        }

        const school = School.create({
            id: Uuid(),
            name: input.name,
            addresses,
            email: input.email,
            phone: input.phone,
            cnpj: input.cnpj ?? null,
            ownerUserId,
            ownerName: input.ownerName ?? null,
            ownerCpf: input.ownerCpf ?? null,
            ownerEmail: input.ownerEmail ?? null,
            ownerBirthDate: input.ownerBirthDate ?? null,
            ownerWhatsapp: e164,
            ownerPasswordHash,
            incomeValue: input.incomeValue
        });
        await this.schools.save(school);

        // Enfileira email de boas-vindas (processado pelo worker quando o módulo admin está ativo)
        if (this.outbox) {
            const to = school.ownerEmail ?? school.email;
            this.outbox
                .enqueue({
                    type: 'send_welcome_school_email',
                    aggregateId: school.id,
                    payload: {
                        to,
                        schoolName: school.name,
                        schoolEmail: school.email,
                        ownerName: school.ownerName ?? undefined,
                        loginUrl: this.frontendBaseUrl ? `${this.frontendBaseUrl}/login` : undefined
                    }
                })
                .catch(() => {});
        }

        // WhatsApp: template Twilio `boas_vindas` (variável `nome`) — worker em `whatsapp_notification`
        if (this.outbox && school.ownerWhatsapp) {
            const nome = (school.ownerName ?? school.name).trim();
            if (nome) {
                this.outbox
                    .enqueue({
                        type: 'whatsapp_notification',
                        aggregateId: school.id,
                        payload: {
                            to: school.ownerWhatsapp,
                            boasVindas: { nome }
                        }
                    })
                    .catch(() => {});
            }
        }

        // A subconta Asaas não é mais criada aqui. Ela é criada no webhook quando o primeiro
        // pagamento do plano é recebido (ensureSchoolSubAccount), usando sempre a escola do invoice pago.

        return {
            id: school.id,
            name: school.name,
            email: school.email,
            phone: school.phone,
            cnpj: school.cnpj,
            addresses: school.addresses.map((address) => address.toPrimitives()),
            createdAt: school.createdAt,
            ownerUserId: school.ownerUserId,
            ownerName: school.ownerName,
            ownerCpf: school.ownerCpf,
            ownerEmail: school.ownerEmail,
            ownerBirthDate: school.ownerBirthDate ? school.ownerBirthDate.toISOString().slice(0, 10) : null,
            ownerWhatsapp: school.ownerWhatsapp,
            incomeValue: school.incomeValue,
            kycUrl: null
        };
    }
}
