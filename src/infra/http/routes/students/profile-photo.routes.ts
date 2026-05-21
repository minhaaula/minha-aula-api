import { Router } from 'express';
import { asyncHandler } from '../../utils/async-handler';
import { AuthenticatedRequest } from '../../middlewares/auth';
import { profilePhotoUpload } from '../../middlewares/profile-photo-upload';
import type { UploadStudentProfilePhoto } from '../../../../app/use-cases/students/upload-student-profile-photo';
import type { RemoveStudentProfilePhoto } from '../../../../app/use-cases/students/remove-student-profile-photo';
import { AppError } from '../../../../shared/errors';

export type StudentProfilePhotoRoutesDeps = {
    uploadStudentProfilePhoto: UploadStudentProfilePhoto;
    removeStudentProfilePhoto: RemoveStudentProfilePhoto;
};

export function buildStudentProfilePhotoRoutes(deps: StudentProfilePhotoRoutesDeps) {
    const router = Router();

    router.post(
        '/',
        profilePhotoUpload.single('image'),
        asyncHandler(async (req, res) => {
            const authReq = req as AuthenticatedRequest;
            const userId = authReq.user?.sub;
            if (!userId) {
                return res.status(401).json({ error: 'Não autorizado', code: 'UNAUTHORIZED' });
            }

            const file = req.file;
            if (!file) {
                throw AppError.validation('Arquivo de imagem é obrigatório (campo image)');
            }

            const result = await deps.uploadStudentProfilePhoto.exec({
                userId,
                file: file.buffer,
                fileName: file.originalname,
                contentType: file.mimetype
            });

            res.status(200).json(result);
        })
    );

    router.delete(
        '/',
        asyncHandler(async (req, res) => {
            const authReq = req as AuthenticatedRequest;
            const userId = authReq.user?.sub;
            if (!userId) {
                return res.status(401).json({ error: 'Não autorizado', code: 'UNAUTHORIZED' });
            }

            const result = await deps.removeStudentProfilePhoto.exec({ userId });
            res.json(result);
        })
    );

    return router;
}
