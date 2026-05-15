export type EnrollmentProgressSchoolLevel = {
    id: string;
    schoolId: string;
    label: string;
    templateCode: string | null;
    sortOrder: number;
    createdAt: Date;
    updatedAt: Date;
};

export type EnrollmentProgressCertificateTemplate = {
    id: string;
    schoolId: string;
    name: string;
    logicalTemplateId: string;
    layoutConfig: Record<string, unknown> | null;
    createdAt: Date;
    updatedAt: Date;
};

export type EnrollmentProgressPromotionRow = {
    id: string;
    enrollmentId: string;
    fromLevelId: string | null;
    toLevelId: string | null;
    fromLevelLabelSnapshot: string | null;
    toLevelLabelSnapshot: string | null;
    fromLevelSortOrderSnapshot: number | null;
    toLevelSortOrderSnapshot: number | null;
    promotedAt: Date;
    notes: string | null;
    createdByUserId: string | null;
    createdAt: Date;
};

export type EnrollmentProgressCertificateRow = {
    id: string;
    enrollmentId: string;
    promotionId: string;
    certificateTemplateId: string;
    status: 'PENDING' | 'GENERATED';
    issuedAt: Date;
    documentUrl: string | null;
    metadata: Record<string, unknown> | null;
    logicalTemplateId?: string | null;
    templateName?: string | null;
};

export type EnrollmentProgressTimelineRow = {
    id: string;
    enrollmentId: string;
    eventType: string;
    payload: Record<string, unknown> | null;
    occurredAt: Date;
    actorUserId: string | null;
    createdAt: Date;
};

export type EnrollmentTimelineContext = {
    id: string;
    schoolId: string;
    status: 'PENDING' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
    enrolledAt: Date;
    updatedAt: Date;
    ownerUserId: string;
};

export type EnrollmentTimelineAggregatedItem = {
    id: string;
    kind: 'ENROLLMENT' | 'LEVEL_PROMOTION' | 'CERTIFICATE' | 'CUSTOM_MILESTONE';
    occurredAt: Date;
    payload: Record<string, unknown>;
};

export type ListEnrollmentTimelinePageInput = {
    enrollmentId: string;
    /** Inclusivo: apenas eventos com occurredAt >= enrolledAt (visão escola). */
    occurredFrom?: Date | null;
    /** Inclusivo: apenas eventos com occurredAt <= fim do período ativo (visão escola). */
    occurredTo?: Date | null;
    limit: number;
    offset: number;
    order: 'asc' | 'desc';
};

export type ListEnrollmentTimelinePageResult = {
    items: EnrollmentTimelineAggregatedItem[];
    total: number;
};

export interface EnrollmentProgressRepository {
    findEnrollmentSummaryInSchool(enrollmentId: string, schoolId: string): Promise<{
        id: string;
        currentSchoolStudentLevelId: string | null;
    } | null>;

    findEnrollmentTimelineContextInSchool(
        enrollmentId: string,
        schoolId: string
    ): Promise<EnrollmentTimelineContext | null>;

    findEnrollmentTimelineContextForOwner(
        enrollmentId: string,
        ownerUserId: string
    ): Promise<EnrollmentTimelineContext | null>;

    listAggregatedTimelinePage(input: ListEnrollmentTimelinePageInput): Promise<ListEnrollmentTimelinePageResult>;

    listLevels(schoolId: string): Promise<EnrollmentProgressSchoolLevel[]>;

    createLevel(input: {
        id: string;
        schoolId: string;
        label: string;
        templateCode: string | null;
        sortOrder: number;
    }): Promise<void>;

    findLevel(schoolId: string, levelId: string): Promise<EnrollmentProgressSchoolLevel | null>;

    updateLevel(input: {
        schoolId: string;
        levelId: string;
        label: string;
        templateCode: string | null;
        sortOrder: number;
    }): Promise<void>;

    deleteLevel(schoolId: string, levelId: string): Promise<void>;

    /** Matrículas com nível atual ou promoções que referenciam o nível. */
    countLevelAssociations(schoolId: string, levelId: string): Promise<number>;

    reorderLevels(schoolId: string, items: Array<{ id: string; sortOrder: number }>): Promise<void>;

    listCertificateTemplates(schoolId: string): Promise<EnrollmentProgressCertificateTemplate[]>;

    createCertificateTemplate(input: {
        id: string;
        schoolId: string;
        name: string;
        logicalTemplateId: string;
        layoutConfig: Record<string, unknown> | null;
    }): Promise<void>;

    findCertificateTemplate(schoolId: string, templateId: string): Promise<EnrollmentProgressCertificateTemplate | null>;

    listPromotions(enrollmentId: string, order?: 'asc' | 'desc'): Promise<EnrollmentProgressPromotionRow[]>;

    findCertificateByPromotionId(promotionId: string): Promise<EnrollmentProgressCertificateRow | null>;

    listCertificatesByEnrollment(enrollmentId: string): Promise<EnrollmentProgressCertificateRow[]>;

    createPromotion(input: {
        id: string;
        enrollmentId: string;
        fromLevelId: string | null;
        toLevelId: string | null;
        fromLevelLabelSnapshot: string | null;
        toLevelLabelSnapshot: string | null;
        fromLevelSortOrderSnapshot: number | null;
        toLevelSortOrderSnapshot: number | null;
        promotedAt: Date;
        notes: string | null;
        createdByUserId: string | null;
    }): Promise<void>;

    findPromotion(enrollmentId: string, promotionId: string): Promise<EnrollmentProgressPromotionRow | null>;

    listTimelineEvents(enrollmentId: string, limit: number): Promise<EnrollmentProgressTimelineRow[]>;

    createTimelineEvent(input: {
        id: string;
        enrollmentId: string;
        eventType: string;
        payload: Record<string, unknown> | null;
        occurredAt: Date;
        actorUserId: string | null;
    }): Promise<void>;

    countCertificatesByPromotionId(promotionId: string): Promise<number>;

    createPromotionCertificate(input: {
        id: string;
        enrollmentId: string;
        promotionId: string;
        certificateTemplateId: string;
        status: 'PENDING' | 'GENERATED';
        issuedAt: Date;
        documentUrl: string | null;
        metadata: Record<string, unknown> | null;
    }): Promise<void>;

    updatePromotionCertificateDocument(input: {
        certificateId: string;
        documentUrl: string;
        status: 'GENERATED';
    }): Promise<void>;
}
