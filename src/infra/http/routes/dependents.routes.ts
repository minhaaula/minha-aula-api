import { Router } from 'express';
import { z } from 'zod';
import { AddDependent } from '../../../app/use-cases/students/add-dependent';
import { ListMyDependents } from '../../../app/use-cases/students/list-my-dependents';
import { DeleteDependent } from '../../../app/use-cases/students/delete-dependent';
import { UpdateDependent } from '../../../app/use-cases/students/update-dependent';
import { AuthenticatedRequest } from '../middlewares/auth';
import { requirePersona } from '../middlewares/require-persona';
import { UserPersonaEnum } from '../../../domain/value-objects/user-persona';
import { asyncHandler } from '../utils/async-handler';
import { profilePhotoUpload } from '../middlewares/profile-photo-upload';
import type { UploadDependentProfilePhoto } from '../../../app/use-cases/students/upload-dependent-profile-photo';
import type { RemoveDependentProfilePhoto } from '../../../app/use-cases/students/remove-dependent-profile-photo';
import { AppError } from '../../../shared/errors';
import { optionalGenderSchema } from '../validators/gender-schemas';

export function dependentsRouter(deps: { 
    addDependent: AddDependent;
    listMyDependents?: ListMyDependents;
    deleteDependent?: DeleteDependent;
    updateDependent?: UpdateDependent;
    uploadDependentProfilePhoto?: UploadDependentProfilePhoto;
    removeDependentProfilePhoto?: RemoveDependentProfilePhoto;
}) {
    const r = Router();

    const requireStudentPersona = requirePersona(UserPersonaEnum.STUDENT);

    r.post('/', requireStudentPersona, asyncHandler(async (req, res) => {
        const authReq = req as AuthenticatedRequest;
        if (!authReq.user?.sub) {
            return res.status(401).json({ 
                error: 'Não autorizado',
                code: 'UNAUTHORIZED'
            });
        }

        const schema = z.object({
            fullName: z.string().trim().min(3, 'Nome deve ter pelo menos 3 caracteres'),
            cpf: z.string().trim().min(11).max(14).optional().nullable(),
            birthDate: z.string().trim().optional().nullable(),
            relationship: z.string().trim().optional().nullable(),
            gender: optionalGenderSchema
        });
        const data = schema.parse(req.body);
        const dependent = await deps.addDependent.exec({
            ownerUserId: authReq.user.sub,
            fullName: data.fullName,
            cpf: data.cpf ?? null,
            birthDate: data.birthDate ?? null,
            relationship: data.relationship ?? null,
            gender: data.gender ?? null
        });
        res.status(201).json(dependent);
    }));

    if (deps.listMyDependents) {
        r.get('/', requireStudentPersona, asyncHandler(async (req, res) => {
            const authReq = req as AuthenticatedRequest;
            if (!authReq.user?.sub) {
                return res.status(401).json({ 
                    error: 'Não autorizado',
                    code: 'UNAUTHORIZED'
                });
            }

            const result = await deps.listMyDependents!.exec({ userId: authReq.user.sub });
            res.json(result);
        }));
    }

    if (deps.uploadDependentProfilePhoto) {
        r.post(
            '/:dependentId/profile-photo',
            requireStudentPersona,
            profilePhotoUpload.single('image'),
            asyncHandler(async (req, res) => {
                const authReq = req as AuthenticatedRequest;
                if (!authReq.user?.sub) {
                    return res.status(401).json({ error: 'Não autorizado', code: 'UNAUTHORIZED' });
                }
                const dependentId = req.params.dependentId?.trim();
                if (!dependentId) {
                    return res.status(400).json({ error: 'ID do dependente é obrigatório', code: 'INVALID_IDENTIFIERS' });
                }
                const file = req.file;
                if (!file) {
                    throw AppError.validation('Arquivo de imagem é obrigatório (campo image)');
                }
                const result = await deps.uploadDependentProfilePhoto!.exec({
                    ownerUserId: authReq.user.sub,
                    dependentId,
                    file: file.buffer,
                    fileName: file.originalname,
                    contentType: file.mimetype
                });
                res.status(200).json(result);
            })
        );
    }

    if (deps.removeDependentProfilePhoto) {
        r.delete(
            '/:dependentId/profile-photo',
            requireStudentPersona,
            asyncHandler(async (req, res) => {
                const authReq = req as AuthenticatedRequest;
                if (!authReq.user?.sub) {
                    return res.status(401).json({ error: 'Não autorizado', code: 'UNAUTHORIZED' });
                }
                const dependentId = req.params.dependentId?.trim();
                if (!dependentId) {
                    return res.status(400).json({ error: 'ID do dependente é obrigatório', code: 'INVALID_IDENTIFIERS' });
                }
                const result = await deps.removeDependentProfilePhoto!.exec({
                    ownerUserId: authReq.user.sub,
                    dependentId
                });
                res.json(result);
            })
        );
    }

    if (deps.updateDependent) {
        r.put('/:id', requireStudentPersona, asyncHandler(async (req, res) => {
            const authReq = req as AuthenticatedRequest;
            if (!authReq.user?.sub) {
                return res.status(401).json({ 
                    error: 'Não autorizado',
                    code: 'UNAUTHORIZED'
                });
            }

            const dependentId = req.params.id?.trim();
            if (!dependentId) {
                return res.status(400).json({ 
                    error: 'ID do dependente é obrigatório',
                    code: 'INVALID_IDENTIFIERS'
                });
            }

            const schema = z.object({
                fullName: z.string().min(3).optional(),
                birthDate: z.string().trim().optional().nullable(),
                relationship: z.string().min(1).optional().nullable(),
                gender: optionalGenderSchema
            });
            const data = schema.parse(req.body);

            const updated = await deps.updateDependent!.exec({
                ownerUserId: authReq.user.sub,
                dependentId,
                fullName: data.fullName,
                birthDate: data.birthDate ?? undefined,
                relationship: data.relationship ?? undefined,
                gender: data.gender !== undefined ? data.gender : undefined
            });

            res.json(updated);
        }));
    }

    if (deps.deleteDependent) {
        r.delete('/:id', requireStudentPersona, asyncHandler(async (req, res) => {
            const authReq = req as AuthenticatedRequest;
            if (!authReq.user?.sub) {
                return res.status(401).json({ 
                    error: 'Não autorizado',
                    code: 'UNAUTHORIZED'
                });
            }

            const dependentId = req.params.id?.trim();
            if (!dependentId) {
                return res.status(400).json({ 
                    error: 'ID do dependente é obrigatório',
                    code: 'INVALID_IDENTIFIERS'
                });
            }

            await deps.deleteDependent!.exec({
                ownerUserId: authReq.user.sub,
                dependentId
            });

            res.status(204).send();
        }));
    }

    return r;
}
