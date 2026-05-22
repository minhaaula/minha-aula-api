import { UserRepository } from '../../../ports/repositories/user.repo';
import { DependentRepository } from '../../../ports/repositories/dependent.repo';
import { Email } from '../../../domain/value-objects/email';
import { PostalAddress } from '../../../domain/value-objects/postal-address';
import { User } from '../../../domain/entities/user';
import { Dependent } from '../../../domain/entities/dependent';
import { UserPersonaEnum } from '../../../domain/value-objects/user-persona';
import type { Gender } from '../../../domain/value-objects/gender';
import { parseGender } from '../../../domain/value-objects/gender';
import type { PostalAddressProps } from '../../../domain/value-objects/postal-address';
import { AppError, ErrorCode } from '../../../shared/errors';

export interface UpdateAdminStudentInput {
    studentId: string;
    fullName?: string;
    email?: string;
    phone?: string;
    cpf?: string | null;
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
    relationship?: string | null;
}

export type UpdateAdminStudentOutput =
    | {
          studentType: 'USER';
          id: string;
          fullName: string;
          email: string;
          phone: string;
          cpf: string;
          birthDate: Date;
          gender: Gender | null;
          address: PostalAddressProps;
      }
    | {
          studentType: 'DEPENDENT';
          id: string;
          userId: string;
          fullName: string;
          cpf: string | null;
          birthDate: Date | null;
          relationship: string | null;
          gender: Gender | null;
      };

export class UpdateAdminStudent {
    constructor(
        private readonly users: UserRepository,
        private readonly dependents: DependentRepository
    ) {}

    async exec(input: UpdateAdminStudentInput): Promise<UpdateAdminStudentOutput> {
        const studentId = input.studentId.trim();
        if (!studentId) {
            throw AppError.fromCode(ErrorCode.INVALID_IDENTIFIERS, {
                message: 'studentId é obrigatório'
            });
        }

        const user = await this.users.findById(studentId);
        if (user) {
            return this.updateUser(user, input);
        }

        const dependent = await this.dependents.findById(studentId);
        if (!dependent || dependent.deletedAt) {
            throw AppError.fromCode(ErrorCode.STUDENT_NOT_FOUND, { studentId });
        }

        return this.updateDependent(dependent, input);
    }

    private async updateUser(
        user: User,
        input: UpdateAdminStudentInput
    ): Promise<UpdateAdminStudentOutput> {
        if (user.persona !== UserPersonaEnum.STUDENT) {
            throw AppError.fromCode(ErrorCode.BUSINESS_RULE_VIOLATION, {
                message: 'Somente cadastros com persona STUDENT podem ser editados por esta rota'
            });
        }

        if (input.email) {
            const email = Email.create(input.email);
            const existing = await this.users.findByEmail(email.value);
            if (existing && existing.id !== user.id) {
                throw AppError.fromCode(ErrorCode.EMAIL_ALREADY_REGISTERED, { email: email.value });
            }
        }

        let cpf = user.cpf;
        if (input.cpf !== undefined) {
            if (input.cpf === null || input.cpf === '') {
                throw AppError.fromCode(ErrorCode.VALIDATION_ERROR, {
                    message: 'CPF do titular não pode ser removido'
                });
            }
            cpf = input.cpf.replace(/\D/g, '');
            if (cpf.length !== 11) {
                throw AppError.fromCode(ErrorCode.INVALID_CPF, { cpf });
            }
            await this.ensureCpfAvailable(cpf, { userId: user.id, dependentId: null });
        }

        let birthDate = user.birthDate;
        if (input.birthDate !== undefined) {
            if (input.birthDate === null) {
                throw AppError.fromCode(ErrorCode.INVALID_BIRTH_DATE, {
                    message: 'birthDate do titular é obrigatório'
                });
            }
            birthDate = this.parseBirthDate(input.birthDate);
        }

        const gender =
            input.gender !== undefined ? this.resolveGender(input.gender) : user.gender;

        const updated = User.create({
            id: user.id,
            fullName: typeof input.fullName === 'string' ? input.fullName : user.fullName,
            birthDate,
            email: input.email ? Email.create(input.email) : user.email,
            phone: typeof input.phone === 'string' ? input.phone : user.phone,
            cpf,
            address: input.address
                ? PostalAddress.create({
                      street: input.address.street,
                      number: input.address.number,
                      complement: input.address.complement ?? null,
                      district: input.address.district ?? null,
                      city: input.address.city,
                      state: input.address.state,
                      zipCode: input.address.zipCode
                  })
                : user.address,
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
            studentType: 'USER',
            id: updated.id,
            fullName: updated.fullName,
            email: updated.email.value,
            phone: updated.phone,
            cpf: updated.cpf,
            birthDate: updated.birthDate,
            gender: updated.gender ?? null,
            address: updated.address.toPrimitives()
        };
    }

    private async updateDependent(
        dependent: Dependent,
        input: UpdateAdminStudentInput
    ): Promise<UpdateAdminStudentOutput> {
        if (input.email !== undefined || input.phone !== undefined || input.address !== undefined) {
            throw AppError.fromCode(ErrorCode.VALIDATION_ERROR, {
                message:
                    'email, phone e address aplicam-se ao titular; para dependente use fullName, cpf, birthDate, relationship e gender'
            });
        }

        const fullName = typeof input.fullName === 'string' ? input.fullName.trim() : dependent.fullName;
        if (!fullName) {
            throw AppError.fromCode(ErrorCode.VALIDATION_ERROR, {
                message: 'fullName é obrigatório'
            });
        }

        if (fullName !== dependent.fullName) {
            const duplicate = await this.dependents.findByUserAndFullName(dependent.userId, fullName);
            if (duplicate && duplicate.id !== dependent.id) {
                throw AppError.fromCode(ErrorCode.DEPENDENT_ALREADY_EXISTS, {
                    userId: dependent.userId,
                    fullName
                });
            }
        }

        const cpf =
            input.cpf !== undefined
                ? input.cpf === null || input.cpf === ''
                    ? null
                    : input.cpf.replace(/\D/g, '')
                : dependent.cpf;

        if (cpf !== null && cpf.length !== 11) {
            throw AppError.fromCode(ErrorCode.INVALID_CPF, { cpf });
        }

        if (input.cpf !== undefined && cpf) {
            await this.ensureCpfAvailable(cpf, {
                userId: null,
                dependentId: dependent.id
            });
        }

        const birthDate =
            input.birthDate !== undefined
                ? input.birthDate
                    ? this.parseBirthDate(input.birthDate)
                    : null
                : dependent.birthDate;

        const relationship =
            input.relationship !== undefined
                ? input.relationship?.trim() || null
                : dependent.relationship;

        const gender =
            input.gender !== undefined ? this.resolveGender(input.gender) : dependent.gender;

        const updated = Dependent.create({
            id: dependent.id,
            userId: dependent.userId,
            fullName,
            cpf,
            birthDate,
            relationship,
            createdAt: dependent.createdAt,
            deletedAt: dependent.deletedAt,
            photoStorageKey: dependent.photoStorageKey,
            gender
        });

        await this.dependents.save(updated);

        return {
            studentType: 'DEPENDENT',
            id: updated.id,
            userId: updated.userId,
            fullName: updated.fullName,
            cpf: updated.cpf,
            birthDate: updated.birthDate,
            relationship: updated.relationship,
            gender: updated.gender ?? null
        };
    }

    private async ensureCpfAvailable(
        cpf: string,
        exclude: { userId: string | null; dependentId: string | null }
    ): Promise<void> {
        const userWithCpf = await this.users.findByCpf(cpf);
        if (userWithCpf && userWithCpf.id !== exclude.userId) {
            throw AppError.fromCode(ErrorCode.CPF_ALREADY_REGISTERED, { cpf });
        }

        const depWithCpf = await this.dependents.findByCpf(cpf);
        if (depWithCpf && depWithCpf.id !== exclude.dependentId) {
            throw AppError.fromCode(ErrorCode.CPF_ALREADY_REGISTERED, { cpf });
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
