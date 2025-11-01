export class Dependent {
    private constructor(
        public readonly id: string,
        public readonly userId: string,
        public readonly fullName: string,
        private readonly _cpf: string | null,
        public readonly birthDate: Date | null,
        public readonly relationship: string | null,
        public readonly createdAt: Date
    ) {}

    static create(params: {
        id: string;
        userId: string;
        fullName: string;
        cpf?: string | null;
        birthDate?: Date | null;
        relationship?: string | null;
        createdAt?: Date;
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
            params.createdAt ?? new Date()
        );
    }

    get cpf(): string | null {
        return this._cpf;
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
