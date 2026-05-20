import type { EnrollmentStatus } from './entities/enrollment.orm';

const BLOCKING: EnrollmentStatus[] = ['ACTIVE', 'PENDING'];

export function computeEnrollmentActiveSlotKeys(params: {
    courseClassId: string;
    status: EnrollmentStatus;
    studentUserId: string | null;
    dependentId: string | null;
}): { activeClassStudentUserKey: string | null; activeClassDependentKey: string | null } {
    const blocking = BLOCKING.includes(params.status);
    return {
        activeClassStudentUserKey:
            blocking && params.studentUserId != null
                ? `${params.courseClassId}|${params.studentUserId}`
                : null,
        activeClassDependentKey:
            blocking && params.dependentId != null
                ? `${params.courseClassId}|${params.dependentId}`
                : null
    };
}
