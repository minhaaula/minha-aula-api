import { SchoolFinancialChargeRepository, StudentPaidTotalByYear } from '../../../ports/repositories/school-financial-charge.repo';

export interface ListStudentPaidTotalsByYearInput {
    userId: string;
}

export interface ListStudentPaidTotalsByYearOutput {
    totalsByYear: StudentPaidTotalByYear[];
}

export class ListStudentPaidTotalsByYear {
    constructor(private readonly financialCharges: SchoolFinancialChargeRepository) {}

    async exec(input: ListStudentPaidTotalsByYearInput): Promise<ListStudentPaidTotalsByYearOutput> {
        const userId = input.userId?.trim();
        if (!userId || !this.financialCharges.getPaidTotalsByYearForOwnerUserId) {
            return { totalsByYear: [] };
        }

        const totalsByYear = await this.financialCharges.getPaidTotalsByYearForOwnerUserId(userId);
        return { totalsByYear };
    }
}
