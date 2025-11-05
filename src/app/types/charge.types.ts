/**
 * Tipos relacionados a cobranças financeiras
 */

import { SchoolFinancialChargeType } from '../../domain/entities/school-financial-charge';

export interface CreateSchoolChargeInput {
    schoolId: string;
    courseId: string;
    courseClassId?: string | null;
    studentUserId?: string | null;
    dependentId?: string | null;
    chargeType: SchoolFinancialChargeType;
    description?: string | null;
    amountCents: number;
    discountCents?: number | null;
    discountReason?: string | null;
    dueDate: Date;
}

