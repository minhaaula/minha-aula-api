import { UserRepository } from '../../../ports/repositories/user.repo';
import type { TokenProviderPort } from '../../../ports/providers/token-provider.port';
import { Email } from '../../../domain/value-objects/email';
import { PostalAddress, PostalAddressProps } from '../../../domain/value-objects/postal-address';
import { User } from '../../../domain/entities/user';
import type { Gender } from '../../../domain/value-objects/gender';
import { parseGender } from '../../../domain/value-objects/gender';
import { AppError, ErrorCode } from '../../../shared/errors';
import { toE164Brazil } from '../../../shared/phone-e164';
import { assertSchoolPersonaCannotUseStudentProfileRoutes } from './assert-school-persona-student-profile-fields';

/** Somente dados pessoais; matrícula não é alterável por esta rota (persona SCHOOL: bloqueio total). */
export interface UpdateStudentProfileInput {
    userId: string;
    profileUpdateVerificationToken: string;
    fullName?: string;
    email?: string;
    phone?: string;
    /** Não aplicado em PUT /students/me — rejeitado no use case se enviado. */
    cpf?: string | null;
    /** Não aplicado em PUT /students/me — rejeitado no use case se enviado. */
    birthDate?: string | null;
    address?: {
        street: string;
        number: string;
        complement?: string | null;
        district?: string | null;
        city: string;
        state: string;
        zipCode: string;
    };
    gender?: Gender | null;
}

export interface UpdateStudentProfileOutput {
    id: string;
    fullName: string;
    email: string;
    cpf: string;
    phone: string;
    birthDate: Date;
    address: PostalAddressProps;
    gender: Gender | null;
    createdAt: Date;
}

export class UpdateStudentProfile {
    constructor(
        private readonly users: UserRepository,
        private readonly tokenProvider: TokenProviderPort
    ) {}

    async exec(input: UpdateStudentProfileInput): Promise<UpdateStudentProfileOutput> {
        const userId = input.userId.trim();
        if (!userId) {
            throw new Error('User id is required');
        }

        const user = await this.users.findById(userId);
        if (!user) {
            throw new Error('User not found');
        }

        assertSchoolPersonaCannotUseStudentProfileRoutes(user);

        await this.assertProfileUpdateVerified(
            input.profileUpdateVerificationToken,
            userId,
            input.phone
        );

        if (input.cpf !== undefined || input.birthDate !== undefined) {
            throw AppError.fromCode(ErrorCode.NOT_ALLOWED, {
                message: 'CPF e data de nascimento não podem ser alterados pelas rotas do aluno'
            });
        }

        if (input.email) {
            const email = Email.create(input.email);
            const existingUser = await this.users.findByEmail(email.value);
            if (existingUser && existingUser.id !== userId) {
                throw new Error('Email already registered');
            }
        }

        const fullName = typeof input.fullName === 'string' ? input.fullName : user.fullName;
        const email = input.email ? Email.create(input.email) : user.email;
        const phone = typeof input.phone === 'string' ? input.phone : user.phone;
        const address = input.address
            ? PostalAddress.create({
                street: input.address.street,
                number: input.address.number,
                complement: input.address.complement ?? null,
                district: input.address.district ?? null,
                city: input.address.city,
                state: input.address.state,
                zipCode: input.address.zipCode
            })
            : user.address;

        const gender =
            input.gender !== undefined
                ? this.resolveGender(input.gender)
                : user.gender;

        const updated = User.create({
            id: user.id,
            fullName,
            birthDate: user.birthDate,
            email,
            phone,
            cpf: user.cpf,
            address,
            persona: user.persona,
            passwordHash: user.passwordHash,
            createdAt: user.createdAt,
            active: user.active,
            deactivationReason: user.deactivationReason,
            deactivationDescription: user.deactivationDescription,
            photoStorageKey: user.photoStorageKey,
            studentAccessEnabled: user.studentAccessEnabled,
            gender
        });

        await this.users.save(updated);

        return {
            id: updated.id,
            fullName: updated.fullName,
            email: updated.email.value,
            cpf: updated.cpf,
            phone: updated.phone,
            birthDate: updated.birthDate,
            address: updated.address.toPrimitives(),
            gender: updated.gender ?? null,
            createdAt: updated.createdAt
        };
    }

    private async assertProfileUpdateVerified(
        token: string,
        userId: string,
        declaredPhone?: string
    ): Promise<void> {
        try {
            const payload = await this.tokenProvider.verify<{
                typ?: string;
                sub?: string;
                ph?: string;
            }>(token.trim());
            if (payload.typ !== 'student_profile_update' || payload.sub !== userId) {
                throw AppError.fromCode(ErrorCode.STUDENT_PROFILE_NOT_VERIFIED);
            }
            if (declaredPhone !== undefined) {
                const e164Declared = toE164Brazil(declaredPhone);
                const e164Token = toE164Brazil(String(payload.ph ?? ''));
                if (!e164Declared || !e164Token || e164Declared !== e164Token) {
                    throw AppError.fromCode(ErrorCode.STUDENT_PROFILE_NOT_VERIFIED);
                }
            }
        } catch (e) {
            if (e instanceof AppError) {
                throw e;
            }
            throw AppError.fromCode(ErrorCode.STUDENT_PROFILE_NOT_VERIFIED);
        }
    }

    private resolveGender(value: Gender | null): Gender | null {
        if (value === null) return null;
        const parsed = parseGender(value);
        if (!parsed) {
            throw AppError.fromCode(ErrorCode.VALIDATION_ERROR, {
                message: 'gender inválido (use MALE ou FEMALE)'
            });
        }
        return parsed;
    }
}
