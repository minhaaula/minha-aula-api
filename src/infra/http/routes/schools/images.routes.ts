import { Router } from 'express';
import multer from 'multer';
import { asyncHandler } from '../../utils/async-handler';
import { SchoolContextRequest } from '../../middlewares/resolve-school-context';
import { SchoolRouteGuards } from './guards';
import type { UploadSchoolImage } from '../../../../app/use-cases/schools/upload-school-image';
import type { ListSchoolImages } from '../../../../app/use-cases/schools/list-school-images';
import { AppError, ErrorCode } from '../../../../shared/errors';

export interface ImagesRoutesDeps {
    uploadSchoolImage?: UploadSchoolImage;
    listSchoolImages?: ListSchoolImages;
}

// Configurar multer para armazenar em memória
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB
    },
    fileFilter: (_req, file, cb) => {
        // Aceitar apenas imagens
        const allowedMimes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
        if (allowedMimes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Tipo de arquivo não permitido. Apenas imagens são aceitas.'));
        }
    }
});

export function buildImagesRoutes(deps: ImagesRoutesDeps, guards: SchoolRouteGuards) {
    const router = Router();

    const protectedMiddleware = [
        guards.requireAuth,
        guards.requireSchoolPersona,
        guards.resolveSchoolContext
    ] as const;

    const uploadSchoolImage = deps.uploadSchoolImage;
    if (uploadSchoolImage) {
        router.post('/', ...protectedMiddleware, upload.single('image'), asyncHandler(async (req, res) => {
            const schoolId = (req as SchoolContextRequest).schoolId as string;
            const file = req.file;
            const category = req.body?.category; // Opcional: GALLERY, LOGO, BANNER, COVER, OTHER

            if (!file) {
                throw AppError.fromCode(ErrorCode.VALIDATION_ERROR, {
                    message: 'Arquivo de imagem é obrigatório'
                });
            }

            const result = await uploadSchoolImage.exec({
                schoolId,
                file: file.buffer,
                fileName: file.originalname,
                contentType: file.mimetype,
                category
            });

            res.status(201).json({
                id: result.id,
                url: result.url,
                key: result.key
            });
        }));
    }

    const listSchoolImages = deps.listSchoolImages;
    if (listSchoolImages) {
        router.get('/', ...protectedMiddleware, asyncHandler(async (req, res) => {
            const schoolId = (req as SchoolContextRequest).schoolId as string;
            const category = req.query.category as string | undefined; // Opcional: filtrar por categoria
            const result = await listSchoolImages.exec({ schoolId, category });
            res.json(result);
        }));
    }

    return router;
}

