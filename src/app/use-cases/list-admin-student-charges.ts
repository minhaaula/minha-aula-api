import { UserRepository } from '../../ports/repositories/user.repo';
import { DependentRepository } from '../../ports/repositories/dependent.repo';
import { SchoolFinancialChargeRepository } from '../../ports/repositories/school-financial-charge.repo';
import { AppError, ErrorCode } from '../../shared/errors';
import type { AdminStudentChargeItem } from '../../ports/repositories/school-financial-charge.repo';

export type ListAdminStudentChargesInput = {
    studentId: string;
};

export type AdminStudentChargeDto = {
    id: string;
    school: { id: string; name: string };
    course: { id: string; name: string };
    class: { id: string; label: string };
    amountCents: number;
    discountCents: number | null;
    discountReason: string | null;
    netAmountCents: number;
    description: string | null;
    chargeType: string;
    dueDate: string;
    status: string;
    paidAt: string | null;
};

export type AdminStudentChargesPersonGroup = {
    studentId: string;
    studentName: string;
    cpf: string | null;
    birthDate: string | null;
    relationship: string | null;
    charges: AdminStudentChargeDto[];
};

export type ListAdminStudentChargesOutput = {
    /** Cobranças do titular (usuário). `null` quando a consulta é por ID de dependente. */
    titular: AdminStudentChargesPersonGroup | null;
    /** Cobranças agrupadas por dependente (vazio quando o titular não tem dependentes). */
    dependents: AdminStudentChargesPersonGroup[];
};

export class ListAdminStudentCharges {
    constructor(
        private readonly users: UserRepository,
        private readonly dependents: DependentRepository,
        private readonly financialCharges: SchoolFinancialChargeRepository
    ) {}

    async exec(input: ListAdminStudentChargesInput): Promise<ListAdminStudentChargesOutput> {
        const studentId = input.studentId?.trim();
        if (!studentId) {
            throw AppError.fromCode(ErrorCode.INVALID_IDENTIFIERS, { message: 'studentId é obrigatório' });
        }

        const findCharges = this.financialCharges.findChargesByStudentIdForAdmin;
        if (!findCharges) {
            return { titular: null, dependents: [] };
        }

        const user = await this.users.findById(studentId);
        if (user) {
            const dependentsList = await this.dependents.findByUserIds([studentId]);
            const titularCharges = await findCharges.call(this.financialCharges, studentId, 'USER');

            const dependents: AdminStudentChargesPersonGroup[] = await Promise.all(
                dependentsList.map(async (dep) => {
                    const depCharges = await findCharges.call(this.financialCharges, dep.id, 'DEPENDENT');
                    return {
                        studentId: dep.id,
                        studentName: dep.fullName,
                        cpf: dep.cpf,
                        birthDate: dep.birthDate ? dep.birthDate.toISOString().slice(0, 10) : null,
                        relationship: dep.relationship,
                        charges: this.mapItems(depCharges)
                    };
                })
            );

            return {
                titular: {
                    studentId: user.id,
                    studentName: user.fullName,
                    cpf: user.cpf,
                    birthDate: user.birthDate ? user.birthDate.toISOString().slice(0, 10) : null,
                    relationship: null,
                    charges: this.mapItems(titularCharges)
                },
                dependents
            };
        }

        const dependent = await this.dependents.findById(studentId);
        if (dependent) {
            const depCharges = await findCharges.call(this.financialCharges, studentId, 'DEPENDENT');
            return {
                titular: null,
                dependents: [
                    {
                        studentId: dependent.id,
                        studentName: dependent.fullName,
                        cpf: dependent.cpf,
                        birthDate: dependent.birthDate ? dependent.birthDate.toISOString().slice(0, 10) : null,
                        relationship: dependent.relationship,
                        charges: this.mapItems(depCharges)
                    }
                ]
            };
        }

        throw AppError.fromCode(ErrorCode.STUDENT_NOT_FOUND, { studentId });
    }

    private mapItems(items: AdminStudentChargeItem[]): AdminStudentChargeDto[] {
        return items.map((item) => ({
            id: item.id,
            school: item.school,
            course: item.course,
            class: item.class,
            amountCents: item.amountCents,
            discountCents: item.discountCents,
            discountReason: item.discountReason,
            netAmountCents: item.netAmountCents,
            description: item.description,
            chargeType: item.chargeType,
            dueDate: item.dueDate.toISOString().slice(0, 10),
            status: item.status,
            paidAt: item.paidAt ? item.paidAt.toISOString() : null
        }));
    }
}
