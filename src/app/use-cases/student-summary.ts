import { Dependent } from '../../domain/entities/dependent';
import { User } from '../../domain/entities/user';
import type { PostalAddressProps } from '../../domain/value-objects/postal-address';

export type DependentSummary = {
    id: string;
    userId: string;
    fullName: string;
    cpf: string | null;
    birthDate: Date | null;
    relationship: string | null;
    createdAt: Date;
};

export type StudentSchoolCourseSummary = {
    id: string;
    name: string;
};

export type StudentSchoolClassSummary = {
    id: string;
    label: string;
    courseId: string;
};

export type StudentSchoolCategorySummary = {
    categoryId: string;
    subcategoryIds: string[];
};

export type StudentSchoolContext = {
    schoolId: string;
    courses: StudentSchoolCourseSummary[];
    classes: StudentSchoolClassSummary[];
    categories: StudentSchoolCategorySummary[];
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
    schoolContext?: StudentSchoolContext;
};

export function buildStudentSummary(student: User, dependents: Dependent[]): StudentSummary {
    const sortedDependents = dependents
        .slice()
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
        .map((dep) => ({
            id: dep.id,
            userId: dep.userId,
            fullName: dep.fullName,
            cpf: dep.cpf,
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
