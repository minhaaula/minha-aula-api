import { UserRepository } from '../../ports/repositories/user.repo';
import { DependentRepository } from '../../ports/repositories/dependent.repo';
import { SchoolFinancialChargeRepository } from '../../ports/repositories/school-financial-charge.repo';
import { AppError, ErrorCode } from '../../shared/errors';
import type { AdminStudentChargeItem } from '../../ports/repositories/school-financial-charge.repo';

export type ListAdminStudentChargesInput = {
    studentId: string;
};

export type ListAdminStudentChargesOutput = {
    charges: Array<{
        id: string;
        school: { id: string; name: string };
        course: { id: string; name: string };
        class: { id: string; label: string };
        amountCents: number;
        discountCents: number | null;
        netAmountCents: number;
        description: string | null;
        dueDate: string;
        status: string;
        paidAt: string | null;
    }>;
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
            return { charges: [] };
        }

        const user = await this.users.findById(studentId);
        if (user) {
            const includeDependents = this.financialCharges.findChargesByOwnerIdIncludingDependentsForAdmin;
            const items = includeDependents
                ? await includeDependents.call(this.financialCharges, studentId)
                : await findCharges.call(this.financialCharges, studentId, 'USER');
            return { charges: this.mapItems(items) };
        }

        const dependent = await this.dependents.findById(studentId);
        if (dependent) {
            const items = await findCharges.call(this.financialCharges, studentId, 'DEPENDENT');
            return { charges: this.mapItems(items) };
        }

        throw AppError.fromCode(ErrorCode.STUDENT_NOT_FOUND, { studentId });
    }

    private mapItems(items: AdminStudentChargeItem[]): ListAdminStudentChargesOutput['charges'] {
        return items.map((item) => ({
            id: item.id,
            school: item.school,
            course: item.course,
            class: item.class,
            amountCents: item.amountCents,
            discountCents: item.discountCents,
            netAmountCents: item.netAmountCents,
            description: item.description,
            dueDate: item.dueDate.toISOString().slice(0, 10),
            status: item.status,
            paidAt: item.paidAt ? item.paidAt.toISOString() : null
        }));
    }
}
