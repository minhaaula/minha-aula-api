/** Status do certificado de promoção (PDF gerado sob demanda no app). */
export const EnrollmentPromotionCertificateStatus = {
    PENDING: 'PENDING',
    GENERATED: 'GENERATED'
} as const;

export type EnrollmentPromotionCertificateStatus =
    (typeof EnrollmentPromotionCertificateStatus)[keyof typeof EnrollmentPromotionCertificateStatus];

export function parseEnrollmentPromotionCertificateStatus(value: string): EnrollmentPromotionCertificateStatus {
    const v = value.trim().toUpperCase();
    if (v === EnrollmentPromotionCertificateStatus.GENERATED) {
        return EnrollmentPromotionCertificateStatus.GENERATED;
    }
    if (v === EnrollmentPromotionCertificateStatus.PENDING) {
        return EnrollmentPromotionCertificateStatus.PENDING;
    }
    throw new Error('Invalid certificate status');
}
