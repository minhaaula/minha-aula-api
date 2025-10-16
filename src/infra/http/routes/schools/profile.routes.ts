import { Router } from 'express';
import { asyncHandler } from '../../utils/async-handler';
import type { GetSchoolProfile } from '../../../../app/use-cases/get-school-profile';
import type { UpdateSchool } from '../../../../app/use-cases/update-school';
import { updateSchoolSchema } from '../../validators/school-schemas';
import type { SchoolRouteGuards } from './guards';
import type { SchoolContextRequest } from '../../middlewares/resolve-school-context';
import { mapAddresses } from './transformers';

type ProfileRoutesDeps = {
    getSchoolProfile?: GetSchoolProfile;
    updateSchool?: UpdateSchool;
};

export function buildProfileRoutes(deps: ProfileRoutesDeps, guards: SchoolRouteGuards) {
    const router = Router();

    if (deps.getSchoolProfile) {
        router.get('/me', guards.requireAuth, guards.requireSchoolPersona, guards.resolveSchoolContext, asyncHandler(async (req, res) => {
            const schoolId = (req as SchoolContextRequest).schoolId as string;
            const profile = await deps.getSchoolProfile!.exec({ schoolId });
            if (!profile) {
                res.status(404).json({ error: 'School not found' });
                return;
            }

            res.json(profile);
        }));
    }

    if (deps.updateSchool) {
        router.put('/me', guards.requireAuth, guards.requireSchoolPersona, guards.resolveSchoolContext, asyncHandler(async (req, res) => {
            const schoolId = (req as SchoolContextRequest).schoolId as string;
            const data = updateSchoolSchema.parse(req.body ?? {});
            const result = await deps.updateSchool!.exec({
                schoolId,
                name: data.name,
                email: data.email,
                phone: data.phone,
                cnpj: data.cnpj,
                addresses: mapAddresses(data.addresses),
                ownerName: data.ownerName === undefined ? undefined : data.ownerName,
                ownerCpf: data.ownerCpf === undefined ? undefined : data.ownerCpf,
                ownerEmail: data.ownerEmail === undefined ? undefined : data.ownerEmail,
                ownerUserId: data.ownerUserId === undefined ? undefined : data.ownerUserId,
                ownerPassword: data.ownerPassword === undefined ? undefined : data.ownerPassword,
                incomeValue: data.incomeValue === undefined ? undefined : data.incomeValue
            });

            res.json(result);
        }));
    }

    return router;
}
