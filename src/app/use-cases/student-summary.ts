import { Dependent } from '../../domain/entities/dependent';
import { User } from '../../domain/entities/user';
import type { PostalAddressProps } from '../../domain/value-objects/postal-address';

export type DependentSummary = {
    id: string;
    userId: string;
    fullName: string;
    birthDate: Date | null;
    relationship: string | null;
    createdAt: Date;
};

export type StudentSummary = {
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

export function buildStudentSummary(student: User, dependents: Dependent[]): StudentSummary {
    const sortedDependents = dependents
        .slice()
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
        .map((dep) => ({
            id: dep.id,
            userId: dep.userId,
            fullName: dep.fullName,
            birthDate: dep.birthDate,
            relationship: dep.relationship,
            createdAt: dep.createdAt
        }));

    return {
        id: student.id,
        fullName: student.fullName,
        email: student.email.value,
        phone: student.phone,
        cpf: student.cpf,
        birthDate: student.birthDate,
        address: student.address.toPrimitives(),
        dependents: sortedDependents,
        createdAt: student.createdAt
    };
}
