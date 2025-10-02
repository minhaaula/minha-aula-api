import { UserRepository } from '../../ports/repositories/user.repo';
import { DependentRepository } from '../../ports/repositories/dependent.repo';
import { UserPersonaEnum } from '../../domain/value-objects/user-persona';
import type { PostalAddressProps } from '../../domain/value-objects/postal-address';

type DependentSummary = {
    id: string;
    userId: string;
    fullName: string;
    birthDate: Date | null;
    relationship: string | null;
    createdAt: Date;
};

type StudentSummary = {
    id: string;
    fullName: string;
    email: string;
    phone: string;
    cpf: string;
    birthDate: Date;
    address: PostalAddressProps;
    dependents: DependentSummary[];
    createdAt: Date;
};

export class ListStudents {
    constructor(
        private readonly users: UserRepository,
        private readonly dependents: DependentRepository
    ) {}

    async exec(): Promise<StudentSummary[]> {
        const students = await this.users.findByPersona(UserPersonaEnum.STUDENT);
        if (students.length === 0) return [];

        const dependents = await this.dependents.findByUserIds(students.map((student) => student.id));
        const dependentsByUser = new Map<string, DependentSummary[]>();
        for (const dep of dependents) {
            const bucket = dependentsByUser.get(dep.userId) ?? [];
            bucket.push({
                id: dep.id,
                userId: dep.userId,
                fullName: dep.fullName,
                birthDate: dep.birthDate,
                relationship: dep.relationship,
                createdAt: dep.createdAt
            });
            dependentsByUser.set(dep.userId, bucket);
        }

        return students
            .slice()
            .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
            .map((student) => ({
                id: student.id,
                fullName: student.fullName,
                email: student.email.value,
                phone: student.phone,
                cpf: student.cpf,
                birthDate: student.birthDate,
                address: student.address.toPrimitives(),
                dependents: (dependentsByUser.get(student.id) ?? []).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()),
                createdAt: student.createdAt
            }));
    }
}
