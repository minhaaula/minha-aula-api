/**
 * Tipos relacionados ao módulo admin
 */

import type { SchoolPlanFinanceView } from '../presenters/school-plan-finance.presenter';
import type { PostalAddressOutput } from './common.types';

export interface SchoolWithPlanItem {
    id: string;
    name: string;
    email: string;
    phone: string;
    cnpj: string;
    addresses: PostalAddressOutput[];
    createdAt: Date;
    ownerName: string | null;
    ownerCpf: string | null;
    ownerEmail: string | null;
    incomeValue: number;
    plan: SchoolPlanFinanceView | null;
}

