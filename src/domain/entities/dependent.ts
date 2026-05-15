export class Dependent {
    private constructor(
        public readonly id: string,
        public readonly userId: string,
        public readonly fullName: string,
        private readonly _cpf: string | null,
        public readonly birthDate: Date | null,
        public readonly relationship: string | null,
        public readonly createdAt: Date,
        private _deletedAt: Date | null = null,
        private _photoStorageKey: string | null = null
    ) {}

    static create(params: {
        id: string;
        userId: string;
        fullName: string;
        cpf?: string | null;
        birthDate?: Date | null;
        relationship?: string | null;
        createdAt?: Date;
        deletedAt?: Date | null;
        photoStorageKey?: string | null;
    }) {
        const userId = params.userId.trim();
        if (!userId) throw new Error('User id is required');
        const fullName = params.fullName.trim();
        if (!fullName) throw new Error('Dependent full name is required');
        const cpf = Dependent.normalizeCpf(params.cpf);
        const birthDate = params.birthDate ?? null;
        if (birthDate && Number.isNaN(birthDate.getTime())) throw new Error('Invalid dependent birth date');
        const relationship = params.relationship?.trim() || null;
        return new Dependent(
            params.id,
            userId,
            fullName,
            cpf,
            birthDate,
            relationship,
            params.createdAt ?? new Date(),
            params.deletedAt ?? null,
            params.photoStorageKey?.trim() || null
        );
    }

    get photoStorageKey(): string | null {
        return this._photoStorageKey;
    }

    applyPhotoStorageKey(key: string | null): void {
        const trimmed = key?.trim();
        this._photoStorageKey = trimmed && trimmed.length > 0 ? trimmed : null;
    }

    get cpf(): string | null {
        return this._cpf;
    }

    get deletedAt(): Date | null {
        return this._deletedAt;
    }

    markAsDeleted(): void {
        this._deletedAt = new Date();
    }

    private static normalizeCpf(value?: string | null): string | null {
        if (value === undefined || value === null || value === '') {
            return null;
        }
        const digits = value.replace(/\D/g, '');
        if (digits.length !== 11) {
            throw new Error('Invalid dependent CPF');
        }
        return digits;
    }
}
