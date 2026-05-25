import { describe, expect, it, vi } from 'vitest';
import { UploadStudentProfilePhoto } from '../../src/app/use-cases/students/upload-student-profile-photo';
import { RemoveStudentProfilePhoto } from '../../src/app/use-cases/students/remove-student-profile-photo';
import { UploadDependentProfilePhoto } from '../../src/app/use-cases/students/upload-dependent-profile-photo';
import { RemoveDependentProfilePhoto } from '../../src/app/use-cases/students/remove-dependent-profile-photo';
import { User } from '../../src/domain/entities/user';
import { Email } from '../../src/domain/value-objects/email';
import { PostalAddress } from '../../src/domain/value-objects/postal-address';
import { UserPersonaEnum } from '../../src/domain/value-objects/user-persona';
import { Dependent } from '../../src/domain/entities/dependent';
import type { UserRepository } from '../../src/ports/repositories/user.repo';
import type { DependentRepository } from '../../src/ports/repositories/dependent.repo';
import type { StorageProviderPort } from '../../src/ports/providers/storage-provider.port';
import { validateProfilePhotoUpload } from '../../src/shared/profile-photo';
import { AppError } from '../../src/shared/errors';

function makeStudent(overrides: { id?: string; photoStorageKey?: string | null } = {}) {
    const address = PostalAddress.create({
        street: 'Rua A',
        number: '1',
        complement: null,
        district: null,
        city: 'SP',
        state: 'SP',
        zipCode: '01000000'
    });
    return User.create({
        id: overrides.id ?? 'user-1',
        fullName: 'Aluno Teste',
        birthDate: new Date('1990-01-01'),
        email: Email.create('aluno@test.com'),
        phone: '11999999999',
        cpf: '12345678901',
        address,
        persona: UserPersonaEnum.STUDENT,
        passwordHash: 'hash',
        photoStorageKey: overrides.photoStorageKey ?? null
    });
}

function makeStorage(): StorageProviderPort {
    return {
        uploadFile: vi.fn(async () => ({
            key: 'students/user-1/profile/new.jpg',
            url: 'https://storage.example/signed-url'
        })),
        deleteFile: vi.fn(async () => undefined),
        getFileUrl: vi.fn(async (key: string) => `https://storage.example/${key}`)
    };
}

describe('profile photo', () => {
    it('rejects non-image content types', () => {
        expect(() => validateProfilePhotoUpload(Buffer.from('x'), 'application/pdf', 'file.pdf')).toThrow(AppError);
    });

    it('uploads student profile photo and replaces previous file', async () => {
        const user = makeStudent({ photoStorageKey: 'old-key' });
        const users: UserRepository = {
            findById: vi.fn(async () => user),
            findByEmail: async () => null,
            findByCpf: async () => null,
            findByPersona: async () => [],
            save: vi.fn(async () => undefined)
        };
        const storage = makeStorage();

        const uc = new UploadStudentProfilePhoto(users, storage);
        const result = await uc.exec({
            userId: 'user-1',
            file: Buffer.from('fake-image'),
            fileName: 'foto.jpg',
            contentType: 'image/jpeg'
        });

        expect(storage.deleteFile).toHaveBeenCalledWith('old-key');
        expect(storage.uploadFile).toHaveBeenCalled();
        expect(user.photoStorageKey).toBe('students/user-1/profile/new.jpg');
        expect(result.photoUrl).toContain('https://');
        expect(users.save).toHaveBeenCalled();
    });

    it('removes student profile photo', async () => {
        const user = makeStudent({ photoStorageKey: 'students/user-1/profile/x.jpg' });
        const users: UserRepository = {
            findById: vi.fn(async () => user),
            findByEmail: async () => null,
            findByCpf: async () => null,
            findByPersona: async () => [],
            save: vi.fn(async () => undefined)
        };
        const storage = makeStorage();

        const uc = new RemoveStudentProfilePhoto(users, storage);
        const result = await uc.exec({ userId: 'user-1' });

        expect(storage.deleteFile).toHaveBeenCalled();
        expect(user.photoStorageKey).toBeNull();
        expect(result.photoUrl).toBeNull();
    });

    it('forbids dependent photo upload when not owner', async () => {
        const dependent = Dependent.create({
            id: 'dep-1',
            userId: 'other-owner',
            fullName: 'Filho'
        });
        const dependents: DependentRepository = {
            findById: vi.fn(async () => dependent),
            findByCpf: async () => null,
            findByUserAndFullName: async () => null,
            findByUserIds: async () => [],
            save: vi.fn()
        };
        const uc = new UploadDependentProfilePhoto(dependents, makeStorage());
        await expect(
            uc.exec({
                ownerUserId: 'user-1',
                dependentId: 'dep-1',
                file: Buffer.from('x'),
                fileName: 'f.jpg',
                contentType: 'image/jpeg'
            })
        ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    });

    it('uploads dependent profile photo for owner', async () => {
        const dependent = Dependent.create({
            id: 'dep-1',
            userId: 'user-1',
            fullName: 'Filho'
        });
        const dependents: DependentRepository = {
            findById: vi.fn(async () => dependent),
            findByCpf: async () => null,
            findByUserAndFullName: async () => null,
            findByUserIds: async () => [],
            save: vi.fn(async () => undefined)
        };
        const storage = makeStorage();
        const uc = new UploadDependentProfilePhoto(dependents, storage);
        const result = await uc.exec({
            ownerUserId: 'user-1',
            dependentId: 'dep-1',
            file: Buffer.from('x'),
            fileName: 'f.png',
            contentType: 'image/png'
        });
        expect(result.photoUrl).toBeTruthy();
        expect(dependents.save).toHaveBeenCalled();
    });

    it('removes dependent profile photo', async () => {
        const dependent = Dependent.create({
            id: 'dep-1',
            userId: 'user-1',
            fullName: 'Filho',
            photoStorageKey: 'students/user-1/dependents/dep-1/profile/x.png'
        });
        const dependents: DependentRepository = {
            findById: vi.fn(async () => dependent),
            findByCpf: async () => null,
            findByUserAndFullName: async () => null,
            findByUserIds: async () => [],
            save: vi.fn(async () => undefined)
        };
        const uc = new RemoveDependentProfilePhoto(dependents, makeStorage());
        const result = await uc.exec({ ownerUserId: 'user-1', dependentId: 'dep-1' });
        expect(result.photoUrl).toBeNull();
        expect(dependent.photoStorageKey).toBeNull();
    });
});
