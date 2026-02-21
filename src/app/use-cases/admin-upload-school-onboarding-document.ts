import type { SchoolRepository } from '../../ports/repositories/school.repo';
import type { AsaasProviderPort } from '../../ports/providers/asaas-port';
import { AppError, ErrorCode } from '../../shared/errors';

/** Tipos de documento aceitos pelo Asaas (POST /myAccount/documents/{id}). */
export const ASAAS_DOCUMENT_TYPES = [
    'IDENTIFICATION',
    'IDENTIFICATION_SELFIE',
    'MINUTES_OF_ELECTION',
    'SOCIAL_CONTRACT',
    'OTHER'
] as const;

export type AsaasDocumentType = (typeof ASAAS_DOCUMENT_TYPES)[number];

export interface AdminUploadSchoolOnboardingDocumentInput {
    schoolId: string;
    documentGroupId: string;
    fileBuffer: Buffer;
    mimeType: string;
    type: string;
}

export interface AdminUploadSchoolOnboardingDocumentOutput {
    schoolId: string;
    documentGroupId: string;
    uploaded: true;
}

/**
 * Envia um documento de onboarding para o Asaas no contexto da subconta da escola.
 * Use quando o onboardingUrl não estiver disponível (envio manual via API).
 * O documentGroupId e type vêm da lista retornada por sync-onboarding-documents.
 */
export class AdminUploadSchoolOnboardingDocument {
    constructor(
        private readonly schools: SchoolRepository,
        private readonly asaasProvider?: AsaasProviderPort
    ) {}

    async exec(input: AdminUploadSchoolOnboardingDocumentInput): Promise<AdminUploadSchoolOnboardingDocumentOutput> {
        const schoolId = input.schoolId?.trim();
        const documentGroupId = input.documentGroupId?.trim();
        const type = input.type?.trim();

        if (!schoolId) {
            throw AppError.fromCode(ErrorCode.REQUIRED_FIELD, { field: 'schoolId' });
        }
        if (!documentGroupId) {
            throw AppError.fromCode(ErrorCode.REQUIRED_FIELD, { field: 'documentGroupId' });
        }
        if (!type) {
            throw AppError.fromCode(ErrorCode.REQUIRED_FIELD, { field: 'type' });
        }
        if (!ASAAS_DOCUMENT_TYPES.includes(type as AsaasDocumentType)) {
            throw AppError.validation(`type deve ser um dos: ${ASAAS_DOCUMENT_TYPES.join(', ')}`, { field: 'type' });
        }
        if (!input.fileBuffer?.length) {
            throw AppError.fromCode(ErrorCode.VALIDATION_ERROR, { message: 'Arquivo de documento é obrigatório' });
        }

        const school = await this.schools.findById(schoolId);
        if (!school) {
            throw AppError.notFound('Escola', { schoolId });
        }
        if (!school.accountApiKey) {
            throw AppError.fromCode(ErrorCode.VALIDATION_ERROR, {
                message: 'Escola não possui conta Asaas (accountApiKey). Gere a conta antes de enviar documentos.'
            });
        }

        if (!this.asaasProvider?.uploadDocument) {
            throw AppError.fromCode(ErrorCode.INTERNAL_ERROR, { message: 'Upload de documentos Asaas não configurado' });
        }

        const mimeType = input.mimeType?.trim() || 'application/octet-stream';
        const allowedMimes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
        if (!allowedMimes.includes(mimeType)) {
            throw AppError.validation('Tipo de arquivo não permitido. Use PDF ou imagem (JPEG/PNG).', { field: 'documentFile' });
        }

        await this.asaasProvider.uploadDocument(
            school.accountApiKey,
            documentGroupId,
            input.fileBuffer,
            mimeType,
            type
        );

        return {
            schoolId,
            documentGroupId,
            uploaded: true
        };
    }
}
