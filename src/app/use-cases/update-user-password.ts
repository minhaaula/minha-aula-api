import { UserRepository } from '../../ports/repositories/user.repo';
import { PasswordHasherPort } from '../../ports/providers/password-hasher.port';

type UpdatePasswordInput = {
    userId: string;
    currentPassword: string;
    newPassword: string;
};

export class UpdateUserPassword {
    constructor(
        private readonly users: UserRepository,
        private readonly hasher: PasswordHasherPort
    ) {}

    async exec(input: UpdatePasswordInput): Promise<void> {
        const user = await this.users.findById(input.userId);
        if (!user) throw new Error('User not found');

        const currentMatches = await this.hasher.compare(input.currentPassword, user.passwordHash);
        if (!currentMatches) throw new Error('Invalid current password');

        const newHash = await this.hasher.hash(input.newPassword);
        user.setPasswordHash(newHash);
        await this.users.save(user);
    }
}
