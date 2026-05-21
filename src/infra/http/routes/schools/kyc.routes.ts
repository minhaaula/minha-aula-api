import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { asyncHandler } from '../../utils/async-handler';
import type { GetSchoolPendingDocuments } from '../../../../app/use-cases/schools/get-school-pending-documents';
import type { SyncSchoolOnboardingDocuments } from '../../../../app/use-cases/schools/sync-school-onboarding-documents';
import type { AdminUploadSchoolOnboardingDocument } from '../../../../app/use-cases/admin/admin-upload-school-onboarding-document';
import type { SyncSchoolSubaccountStatus } from '../../../../app/use-cases/schools/sync-school-subaccount-status';
import type { ResendSchoolAsaasBankAccount } from '../../../../app/use-cases/schools/resend-school-asaas-bank-account';
import type { SchoolRouteGuards } from './guards';
import type { SchoolContextRequest } from '../../middlewares/resolve-school-context';
import { AppError, ErrorCode } from '../../../../shared/errors';

const documentUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
        const allowed = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
        if (allowed.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Tipo não permitido. Use PDF ou imagem (JPEG/PNG).'));
        }
    }
});

type KycRoutesDeps = {
    getSchoolPendingDocuments?: GetSchoolPendingDocuments;
    syncSchoolOnboardingDocuments?: SyncSchoolOnboardingDocuments;
    uploadSchoolOnboardingDocument?: AdminUploadSchoolOnboardingDocument;
    syncSchoolSubaccountStatus?: SyncSchoolSubaccountStatus;
    resendSchoolAsaasBankAccount?: ResendSchoolAsaasBankAccount;
};

export function buildKycRoutes(deps: KycRoutesDeps, guards: SchoolRouteGuards) {
    const router = Router();
    const { requireAuth, requireSchoolPersona, resolveSchoolContext } = guards;
    const protectedMiddleware = [requireAuth, requireSchoolPersona, resolveSchoolContext] as const;

    if (deps.getSchoolPendingDocuments) {
        router.get('/documents', ...protectedMiddleware, asyncHandler(async (req, res) => {
            const schoolId = (req as SchoolContextRequest).schoolId as string;

            const result = await deps.getSchoolPendingDocuments!.exec({ schoolId });

            res.json({
                documents: result.documents,
                onboardingUrl: result.onboardingUrl
            });
        }));
    }

    if (deps.syncSchoolSubaccountStatus) {
        router.get('/asaas-account-status', ...protectedMiddleware, asyncHandler(async (req, res) => {
            const schoolId = (req as SchoolContextRequest).schoolId as string;
            const result = await deps.syncSchoolSubaccountStatus!.exec({ schoolId });
            res.json({
                id: result.status.id,
                commercialInfo: result.status.commercialInfo,
                bankAccountInfo: result.status.bankAccountInfo,
                documentation: result.status.documentation,
                general: result.status.general,
                onboardingCompletedAt: result.onboardingCompletedAt
            });
        }));
    }

    if (deps.syncSchoolOnboardingDocuments) {
        router.post('/sync-onboarding-documents', ...protectedMiddleware, asyncHandler(async (req, res) => {
            const schoolId = (req as SchoolContextRequest).schoolId as string;

            const result = await deps.syncSchoolOnboardingDocuments!.exec({ schoolId });

            res.json(result);
        }));
    }

    if (deps.syncSchoolOnboardingDocuments || deps.syncSchoolSubaccountStatus) {
        router.post('/resend', ...protectedMiddleware, asyncHandler(async (req, res) => {
            const schoolId = (req as SchoolContextRequest).schoolId as string;

            const documents = deps.syncSchoolOnboardingDocuments
                ? await deps.syncSchoolOnboardingDocuments.exec({ schoolId })
                : null;
            const status = deps.syncSchoolSubaccountStatus
                ? await deps.syncSchoolSubaccountStatus.exec({ schoolId })
                : null;

            res.json({
                documents,
                status: status
                    ? {
                        id: status.status.id,
                        commercialInfo: status.status.commercialInfo,
                        bankAccountInfo: status.status.bankAccountInfo,
                        documentation: status.status.documentation,
                        general: status.status.general,
                        onboardingCompletedAt: status.onboardingCompletedAt
                    }
                    : null
            });
        }));
    }

    if (deps.resendSchoolAsaasBankAccount) {
        router.post('/bank-account/resend', ...protectedMiddleware, asyncHandler(async (req, res) => {
            const schoolId = (req as SchoolContextRequest).schoolId as string;
            const bodySchema = z.object({
                otpChallengeId: z.string().uuid(),
                bankAccountId: z.string().uuid().optional().nullable()
            });
            const body = bodySchema.parse(req.body ?? {});

            const result = await deps.resendSchoolAsaasBankAccount!.exec({
                schoolId,
                otpChallengeId: body.otpChallengeId,
                bankAccountId: body.bankAccountId ?? null
            });

            res.json(result);
        }));
    }

    const uploadSchoolOnboardingDocument = deps.uploadSchoolOnboardingDocument;
    if (uploadSchoolOnboardingDocument) {
        router.post('/documents/:documentGroupId/upload', ...protectedMiddleware, documentUpload.single('documentFile'), asyncHandler(async (req, res) => {
            const schoolId = (req as SchoolContextRequest).schoolId as string;
            const paramsSchema = z.object({ documentGroupId: z.string().min(1) });
            const { documentGroupId } = paramsSchema.parse(req.params);
            const type = z.string().min(1).parse(req.body?.type);
            const file = req.file;
            if (!file) {
                throw AppError.fromCode(ErrorCode.VALIDATION_ERROR, { message: 'Campo documentFile é obrigatório' });
            }
            const result = await uploadSchoolOnboardingDocument.exec({
                schoolId,
                documentGroupId,
                fileBuffer: file.buffer,
                mimeType: file.mimetype,
                type
            });
            res.json(result);
        }));
    }


    return router;
}

