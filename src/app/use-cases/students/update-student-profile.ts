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
import { assertTitularMinimumAge } from '../../../shared/is-minor-by-birth-date';

/** Somente dados pessoais; matrícula não é alterável por esta rota (persona SCHOOL: bloqueio total). */
export interface UpdateStudentProfileInput {
    userId: string;
    profileUpdateVerificationToken: string;
    fullName?: string;
    email?: string;
    phone?: string;
    /** Não pode ser alterado em PUT /students/me. */
    cpf?: string | null;
    birthDate?: string;
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

        if (input.cpf !== undefined) {
            throw AppError.fromCode(ErrorCode.NOT_ALLOWED, {
                message: 'CPF não pode ser alterado pelas rotas do aluno'
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

        const birthDate =
            input.birthDate !== undefined ? this.parseBirthDate(input.birthDate) : user.birthDate;

        assertTitularMinimumAge(birthDate);

        const updated = User.create({
            id: user.id,
            fullName,
            birthDate,
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

    private parseBirthDate(value: string): Date {
        const parsed = new Date(value);
        if (Number.isNaN(parsed.getTime())) {
            throw AppError.fromCode(ErrorCode.INVALID_BIRTH_DATE, { birthDate: value });
        }
        return new Date(
            Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth(), parsed.getUTCDate())
        );
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
