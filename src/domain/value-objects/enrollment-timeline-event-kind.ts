/** Tipos canônicos exibidos na timeline agregada por matrícula. */
export const EnrollmentTimelineEventKind = {
    ENROLLMENT: 'ENROLLMENT',
    LEVEL_PROMOTION: 'LEVEL_PROMOTION',
    CERTIFICATE: 'CERTIFICATE',
    CUSTOM_MILESTONE: 'CUSTOM_MILESTONE'
} as const;

export type EnrollmentTimelineEventKind =
    (typeof EnrollmentTimelineEventKind)[keyof typeof EnrollmentTimelineEventKind];
