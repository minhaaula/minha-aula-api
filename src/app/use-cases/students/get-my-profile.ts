import { UserRepository } from '../../../ports/repositories/user.repo';
import { DependentRepository } from '../../../ports/repositories/dependent.repo';
import type { StorageProviderPort } from '../../../ports/providers/storage-provider.port';
import { resolveProfilePhotoUrl } from '../../../shared/profile-photo';
import type { Gender } from '../../../domain/value-objects/gender';

export interface StudentProfile {
    id: string;
    fullName: string;
    email: string;
    cpf: string;
    phone: string;
    birthDate: Date;
    gender: Gender | null;
    address: {
        street: string;
        number: string;
        complement: string | null;
        district: string | null;
        city: string;
        state: string;
        zipCode: string;
    };
    createdAt: Date;
    photoUrl: string | null;
    dependents: Array<{
        id: string;
        fullName: string;
        cpf: string | null;
        birthDate: Date | null;
        relationship: string | null;
        gender: Gender | null;
        photoUrl: string | null;
    }>;
}

export class GetMyProfile {
    constructor(
        private readonly users: UserRepository,
        private readonly dependents: DependentRepository,
        private readonly storage?: StorageProviderPort
    ) {}

    async exec(input: { userId: string }): Promise<StudentProfile | null> {
        const userId = input.userId?.trim();
        if (!userId) {
            return null;
        }

        const user = await this.users.findById(userId);
        if (!user) {
            return null;
        }

        const dependentsList = await this.dependents.findByUserIds([userId]);

        const photoUrl = this.storage
            ? await resolveProfilePhotoUrl(this.storage, user.photoStorageKey)
            : user.photoStorageKey;

        const addressPrimitives = user.address.toPrimitives();
        return {
            id: user.id,
            fullName: user.fullName,
            email: user.email.value,
            cpf: user.cpf,
            phone: user.phone,
            birthDate: user.birthDate,
            gender: user.gender,
            address: {
                street: addressPrimitives.street,
                number: addressPrimitives.number,
                complement: addressPrimitives.complement ?? null,
                district: addressPrimitives.district ?? null,
                city: addressPrimitives.city,
                state: addressPrimitives.state,
                zipCode: addressPrimitives.zipCode
            },
            createdAt: user.createdAt,
            photoUrl,
            dependents: await Promise.all(
                dependentsList.map(async (dep) => ({
                    id: dep.id,
                    fullName: dep.fullName,
                    cpf: dep.cpf,
                    birthDate: dep.birthDate,
                    relationship: dep.relationship,
                    gender: dep.gender,
                    photoUrl: this.storage
                        ? await resolveProfilePhotoUrl(this.storage, dep.photoStorageKey)
                        : dep.photoStorageKey
                }))
            )
        };
    }
}

