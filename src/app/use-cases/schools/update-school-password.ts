import { SchoolRepository } from '../../../ports/repositories/school.repo';
import { PasswordHasherPort } from '../../../ports/providers/password-hasher.port';

type UpdateSchoolPasswordInput = {
    schoolId: string;
    currentPassword: string;
    newPassword: string;
};

export class UpdateSchoolPassword {
    constructor(
        private readonly schools: SchoolRepository,
        private readonly hasher: PasswordHasherPort
    ) {}

    async exec(input: UpdateSchoolPasswordInput): Promise<void> {
        const school = await this.schools.findById(input.schoolId);
        if (!school) {
            throw new Error('Escola não encontrada');
        }

        if (!school.ownerPasswordHash) {
            throw new Error('Senha não configurada');
        }

        const currentMatches = await this.hasher.compare(
            input.currentPassword,
            school.ownerPasswordHash
        );
        
        if (!currentMatches) {
            throw new Error('Senha atual inválida');
        }

        const newHash = await this.hasher.hash(input.newPassword);
        
        if (!this.schools.updateOwnerPassword) {
            throw new Error('Atualização de senha não disponível');
        }
        
        await this.schools.updateOwnerPassword(school.id, newHash);
    }
}

