import { UserRepository } from '../../ports/repositories/user.repo';
import { DependentRepository } from '../../ports/repositories/dependent.repo';
import { UserPersonaEnum } from '../../domain/value-objects/user-persona';
import { Dependent } from '../../domain/entities/dependent';
import { buildStudentSummary, type StudentSummary } from './student-summary';

export class ListStudents {
    constructor(
        private readonly users: UserRepository,
        private readonly dependents: DependentRepository
    ) {}

    async exec(filters?: { cpf?: string | null }): Promise<StudentSummary[]> {
        const cpfFilter = filters?.cpf?.trim();
        if (cpfFilter) {
            const normalizedCpf = this.normalizeCpf(cpfFilter);
            const student = await this.users.findByCpf(normalizedCpf);
            if (!student || student.persona !== UserPersonaEnum.STUDENT) {
                return [];
            }

            const dependents = await this.dependents.findByUserIds([student.id]);
            return [buildStudentSummary(student, dependents)];
        }

        const students = await this.users.findByPersona(UserPersonaEnum.STUDENT);
        if (students.length === 0) return [];

        const dependents = await this.dependents.findByUserIds(students.map((student) => student.id));
        const dependentsByUser = new Map<string, Dependent[]>();
        for (const dep of dependents) {
            const bucket = dependentsByUser.get(dep.userId) ?? [];
            bucket.push(dep);
            dependentsByUser.set(dep.userId, bucket);
        }

        return students
            .slice()
            .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
            .map((student) => buildStudentSummary(student, dependentsByUser.get(student.id) ?? []));
    }

    private normalizeCpf(input: string): string {
        const digits = input.replace(/\D/g, '');
        if (digits.length !== 11) {
            throw new Error('Invalid CPF');
        }
        return digits;
    }
}
