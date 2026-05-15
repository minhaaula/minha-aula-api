import type { StorageProviderPort } from '../ports/providers/storage-provider.port';
import { AppError } from './errors';

/** Formatos aceitos para foto de perfil (aluno e dependente). */
export const PROFILE_PHOTO_ALLOWED_CONTENT_TYPES = ['image/jpeg', 'image/jpg', 'image/png'] as const;

export const PROFILE_PHOTO_MAX_BYTES = 5 * 1024 * 1024;

/** Validade da URL assinada retornada ao cliente (7 dias). */
export const PROFILE_PHOTO_URL_EXPIRES_SECONDS = 7 * 24 * 3600;

export function validateProfilePhotoUpload(file: Buffer, contentType: string, fileName?: string): void {
    const normalizedType = contentType.toLowerCase().split(';')[0].trim();
    if (!PROFILE_PHOTO_ALLOWED_CONTENT_TYPES.includes(normalizedType as (typeof PROFILE_PHOTO_ALLOWED_CONTENT_TYPES)[number])) {
        throw AppError.validation('Tipo de arquivo não permitido. Apenas JPG e PNG são aceitos.', {
            contentType
        });
    }

    if (file.length > PROFILE_PHOTO_MAX_BYTES) {
        throw AppError.validation('Arquivo muito grande. Tamanho máximo: 5MB.', {
            fileSize: file.length
        });
    }

    if (fileName) {
        const ext = fileName.toLowerCase().split('.').pop();
        if (ext && !['jpg', 'jpeg', 'png'].includes(ext)) {
            throw AppError.validation('Extensão de arquivo não permitida. Use .jpg ou .png.');
        }
    }
}

export function profilePhotoFileExtension(contentType: string, fileName?: string): string {
    const normalizedType = contentType.toLowerCase().split(';')[0].trim();
    if (normalizedType === 'image/png') return '.png';
    if (fileName) {
        const lastDot = fileName.lastIndexOf('.');
        if (lastDot !== -1) {
            const ext = fileName.substring(lastDot).toLowerCase();
            if (ext === '.png' || ext === '.jpg' || ext === '.jpeg') return ext === '.jpeg' ? '.jpg' : ext;
        }
    }
    return '.jpg';
}

/** Converte chave de storage ou URL legada em URL acessível (assinada). */
export async function resolveProfilePhotoUrl(
    storage: StorageProviderPort,
    stored: string | null | undefined
): Promise<string | null> {
    if (!stored?.trim()) return null;
    const value = stored.trim();
    if (value.startsWith('http://') || value.startsWith('https://')) {
        return value;
    }
    return storage.getFileUrl(value, PROFILE_PHOTO_URL_EXPIRES_SECONDS);
}

export async function deleteProfilePhotoFromStorage(
    storage: StorageProviderPort,
    stored: string | null | undefined
): Promise<void> {
    if (!stored?.trim()) return;
    const value = stored.trim();
    if (value.startsWith('http://') || value.startsWith('https://')) {
        return;
    }
    try {
        await storage.deleteFile(value);
    } catch {
        // Ignora falha ao remover arquivo antigo no storage
    }
}
