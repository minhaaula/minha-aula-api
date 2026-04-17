import { UserRepository } from '../../ports/repositories/user.repo';
import type { TokenProviderPort } from '../../ports/providers/token-provider.port';
import { PasswordHasherPort } from '../../ports/providers/password-hasher.port';
import { Email } from '../../domain/value-objects/email';
import { User } from '../../domain/entities/user';
import { Uuid } from '../../shared/uuid';
import { PostalAddress } from '../../domain/value-objects/postal-address';
import { UserPersona, assertUserPersona, UserPersonaEnum } from '../../domain/value-objects/user-persona';
import { OutboxRepository } from '../../ports/repositories/outbox.repo';
import { AppError, ErrorCode } from '../../shared/errors';
import type { RegisterUserInput, RegisterUserOutput } from '../types/auth.types';
import type { NotifyStudentUser } from './notify-student-user';
import { toE164Brazil } from '../../shared/phone-e164';

export class RegisterUser {
    constructor(
        private readonly users: UserRepository,
        private readonly hasher: PasswordHasherPort,
        private readonly tokenProvider: TokenProviderPort,
        private readonly outbox?: OutboxRepository,
        private readonly frontendBaseUrl?: string,
        private readonly notifyStudent?: NotifyStudentUser
    ) {}

    async exec(input: RegisterUserInput): Promise<RegisterUserOutput> {
        const email = Email.create(input.email);

        const existingByEmail = await this.users.findByEmail(email.value);
        if (existingByEmail) {
            throw AppError.fromCode(ErrorCode.EMAIL_ALREADY_REGISTERED, { email: email.value });
        }

        const cpf = this.normalizeCpf(input.cpf);
        const existingByCpf = await this.users.findByCpf(cpf);
        if (existingByCpf) {
            throw AppError.fromCode(ErrorCode.CPF_ALREADY_REGISTERED, { cpf });
        }

        await this.assertSignupPhoneVerified(input.phoneVerificationToken, input.phone);

        const birthDate = new Date(input.birthDate);
        if (Number.isNaN(birthDate.getTime())) {
            throw AppError.fromCode(ErrorCode.INVALID_BIRTH_DATE, { birthDate: input.birthDate });
        }

        assertUserPersona(input.persona);

        const address = PostalAddress.create({
            street: input.address.street,
            number: input.address.number,
            complement: input.address.complement ?? null,
            district: input.address.district ?? null,
            city: input.address.city,
            state: input.address.state,
            zipCode: input.address.zipCode
        });

        const passwordHash = await this.hasher.hash(input.password);
        const user = User.create({
            id: Uuid(),
            fullName: input.fullName,
            birthDate,
            email,
            phone: input.phone,
            cpf,
            address,
            persona: input.persona,
            passwordHash
        });

        await this.users.save(user);

        // Enfileira email de boas-vindas para aluno (processado pelo worker quando o módulo admin está ativo)
        if (user.persona === UserPersonaEnum.STUDENT && this.outbox) {
            this.outbox
                .enqueue({
                    type: 'send_welcome_student_email',
                    aggregateId: user.id,
                    payload: {
                        to: user.email.value,
                        userName: user.fullName,
                        userEmail: user.email.value,
                        loginUrl: this.frontendBaseUrl ? `${this.frontendBaseUrl}/login` : undefined
                    }
                })
                .catch(() => {});

            // WhatsApp: template Twilio `boas_vindas` (variável `nome`) — worker em `whatsapp_notification`
            this.outbox
                .enqueue({
                    type: 'whatsapp_notification',
                    aggregateId: user.id,
                    payload: {
                        userIds: [user.id],
                        boasVindas: { nome: user.fullName }
                    }
                })
                .catch(() => {});
        }

        if (user.persona === UserPersonaEnum.STUDENT && this.notifyStudent) {
            this.notifyStudent
                .exec({
                    userId: user.id,
                    title: 'Bem-vindo ao Minha Aula',
                    message: `Olá, ${user.fullName}! Sua conta de aluno foi criada. Explore cursos e turmas no app.`,
                    kind: 'WELCOME',
                    sendPush: false,
                    extraMetadata: {}
                })
                .catch(() => {});
        }

        return {
            userId: user.id,
            fullName: user.fullName,
            email: user.email.value,
            cpf: user.cpf,
            persona: user.persona,
            createdAt: user.createdAt
        };
    }

    private normalizeCpf(value: string) {
        const digits = value.replace(/\D/g, '');
        if (digits.length !== 11) {
            throw AppError.fromCode(ErrorCode.INVALID_CPF, { cpf: value });
        }
        return digits;
    }

    private async assertSignupPhoneVerified(token: string, declaredPhone: string): Promise<void> {
        const e164Declared = toE164Brazil(declaredPhone);
        if (!e164Declared) {
            throw AppError.fromCode(ErrorCode.INVALID_PHONE, { phone: declaredPhone });
        }
        try {
            const payload = await this.tokenProvider.verify<{ typ?: string; ph?: string }>(token.trim());
            if (payload.typ !== 'signup_phone') {
                throw AppError.fromCode(ErrorCode.SIGNUP_PHONE_NOT_VERIFIED);
            }
            const e164Token = toE164Brazil(String(payload.ph ?? ''));
            if (!e164Token || e164Token !== e164Declared) {
                throw AppError.fromCode(ErrorCode.SIGNUP_PHONE_NOT_VERIFIED);
            }
        } catch (e) {
            if (e instanceof AppError) {
                throw e;
            }
            throw AppError.fromCode(ErrorCode.SIGNUP_PHONE_NOT_VERIFIED);
        }
    }
}
