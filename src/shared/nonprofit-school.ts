import type { TuitionExemptionType } from '../domain/value-objects/tuition-exemption-type';
import { AppError, ErrorCode } from './errors';

/** Mensalidade efetiva da turma: valor da turma ou, se ausente, do curso. */
export function resolveEffectiveClassMonthlyPriceCents(
    classMonthlyPriceCents: number | null,
    courseMonthlyPriceCents: number | null
): number | null {
    if (classMonthlyPriceCents !== null) {
        return classMonthlyPriceCents;
    }
    return courseMonthlyPriceCents ?? null;
}

/** Associação sem fins lucrativos não pode ter mensalidade com valor acima de R$ 0,00. */
export function assertNonprofitSchoolAllowsClassMonthlyPrice(
    isNonprofitAssociation: boolean,
    classMonthlyPriceCents: number | null,
    courseMonthlyPriceCents: number | null
): void {
    if (!isNonprofitAssociation) {
        return;
    }

    const effective = resolveEffectiveClassMonthlyPriceCents(
        classMonthlyPriceCents,
        courseMonthlyPriceCents
    );
    if (effective !== null && effective > 0) {
        throw AppError.fromCode(ErrorCode.NONPROFIT_CLASS_PRICE_NOT_ALLOWED, {
            effectiveMonthlyPriceCents: effective
        });
    }
}

/** Matrículas de escolas sem fins lucrativos não podem ser editadas (escola nem admin). */
export function assertNonprofitSchoolAllowsEnrollmentEdit(isNonprofitAssociation: boolean): void {
    if (!isNonprofitAssociation) {
        return;
    }
    throw AppError.fromCode(ErrorCode.NONPROFIT_ENROLLMENT_EDIT_FORBIDDEN);
}

/**
 * Escola sem fins lucrativos: matrícula sempre isenta (`NONPROFIT`), sem cobrança de mensalidade.
 * Ignora tipo solicitado pelo cliente — não é possível matricular como pagante.
 */
export function resolveNonprofitTuitionExemptionType(
    isNonprofitAssociation: boolean,
    requested: TuitionExemptionType | null | undefined
): TuitionExemptionType | null {
    if (!isNonprofitAssociation) {
        return requested ?? null;
    }
    return 'NONPROFIT';
}
