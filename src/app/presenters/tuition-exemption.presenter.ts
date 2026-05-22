import type { TuitionExemptionType } from '../../domain/value-objects/tuition-exemption-type';
import { parseTuitionExemptionType } from '../../domain/value-objects/tuition-exemption-type';

export type TuitionExemptionApiFields = {
    monthlyTuition: 'EXEMPT' | null;
    tuitionExemptionType: TuitionExemptionType | null;
};

export function presentTuitionExemption(
    tuitionExemptionType: TuitionExemptionType | null | undefined
): TuitionExemptionApiFields {
    const type = tuitionExemptionType ?? null;
    return {
        monthlyTuition: type ? 'EXEMPT' : null,
        tuitionExemptionType: type
    };
}

/** Maps TypeORM raw row alias `enrollment_tuition_exemption_type`. */
export function presentTuitionExemptionFromEnrollmentRaw(row: {
    enrollment_tuition_exemption_type?: string | null;
}): TuitionExemptionApiFields {
    const type = parseTuitionExemptionType(row.enrollment_tuition_exemption_type ?? null);
    return presentTuitionExemption(type);
}
