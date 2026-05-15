import multer from 'multer';
import { PROFILE_PHOTO_ALLOWED_CONTENT_TYPES, PROFILE_PHOTO_MAX_BYTES } from '../../../shared/profile-photo';

export const profilePhotoUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: PROFILE_PHOTO_MAX_BYTES },
    fileFilter: (_req, file, cb) => {
        const allowed = PROFILE_PHOTO_ALLOWED_CONTENT_TYPES as readonly string[];
        if (allowed.includes(file.mimetype.toLowerCase())) {
            cb(null, true);
        } else {
            cb(new Error('Tipo de arquivo não permitido. Apenas JPG e PNG são aceitos.'));
        }
    }
});
