import { UserRepository } from '../../../ports/repositories/user.repo';
import { DependentRepository } from '../../../ports/repositories/dependent.repo';
import { canActAsStudent } from '../../../shared/user-student-access';
import type { Gender } from '../../../domain/value-objects/gender';

export type StudentDirectoryPerson = {
    id: string;
    name: string;
    cpf: string;
    birthDate: Date | null;
    gender: Gender | null;
};

export type StudentDirectoryEntry = {
    student: StudentDirectoryPerson;
    responsible: StudentDirectoryPerson | null;
    isDependent: boolean;
};

export class GetStudentDirectoryEntry {
    constructor(
        private readonly users: UserRepository,
        private readonly dependents: DependentRepository
    ) {}

    async exec(params: { cpf: string }): Promise<StudentDirectoryEntry | null> {
        const cpf = this.normalizeCpf(params.cpf);

        const dependent = await this.dependents.findByCpf(cpf);
        if (dependent) {
            const responsible = await this.users.findById(dependent.userId);
            if (!responsible) {
                return null;
            }

            return {
                student: {
                    id: dependent.id,
                    name: dependent.fullName,
                    cpf,
                    birthDate: dependent.birthDate ?? null,
                    gender: dependent.gender
                },
                responsible: {
                    id: responsible.id,
                    name: responsible.fullName,
                    cpf: responsible.cpf,
                    birthDate: responsible.birthDate,
                    gender: responsible.gender
                },
                isDependent: true
            };
        }

        const student = await this.users.findByCpf(cpf);
        if (!student || !canActAsStudent(student)) {
            return null;
        }

        return {
            student: {
                id: student.id,
                name: student.fullName,
                cpf: student.cpf,
                birthDate: student.birthDate,
                gender: student.gender
            },
            responsible: null,
            isDependent: false
        };
    }

    private normalizeCpf(value: string): string {
        const digits = value.replace(/\D/g, '');
        if (digits.length !== 11) {
            throw new Error('Invalid CPF');
        }
        return digits;
    }
}
