import { ModuleBuildResult, ModuleSetupContext } from './types';
import { RegisterUser } from '../../app/use-cases/register-user';
import { LoginUser } from '../../app/use-cases/login-user';
import { RefreshToken } from '../../app/use-cases/refresh-token';
import { authRouter } from '../../infra/http/routes/auth.routes';
import { ScryptPasswordHasher } from '../../infra/auth/scrypt-password-hasher';
import { HmacTokenProvider } from '../../infra/auth/hmac-token-provider';
import { UserRepositoryAdapter } from '../../infra/db/typeorm/user-repository.adapter';
import { SchoolRepositoryAdapter } from '../../infra/db/typeorm/school-repository';
import type { ModuleName } from '../module-config';
import { UpdateUserPassword } from '../../app/use-cases/update-user-password';
import { RequestUserPasswordReset } from '../../app/use-cases/request-user-password-reset';
import { ResetUserPassword } from '../../app/use-cases/reset-user-password';
import { ValidatePasswordResetToken } from '../../app/use-cases/validate-password-reset-token';
import { PasswordResetTokenRepositoryAdapter } from '../../infra/db/typeorm/password-reset-token-repository.adapter';
import { EmailProviderPort } from '../../ports/providers/email-provider.port';
import type { OutboxRepository } from '../../ports/repositories/outbox.repo';
import type { NotifyStudentUser } from '../../app/use-cases/notify-student-user';

export type AuthModuleDeps = {
    usersRepo: UserRepositoryAdapter;
    passwordHasher: ScryptPasswordHasher;
    tokenProvider: HmacTokenProvider;
    tokenTtl: number;
    activeModules?: readonly ModuleName[];
    schoolsRepo: SchoolRepositoryAdapter;
    emailProvider?: EmailProviderPort;
    outbox?: OutboxRepository;
    frontendBaseUrl?: string;
    /** Notificação in-app + fila (quando repositório e outbox estão disponíveis). */
    notifyStudent?: NotifyStudentUser;
};

export function buildAuthModule(deps: AuthModuleDeps, ctx: ModuleSetupContext): ModuleBuildResult {
    const registerUser = new RegisterUser(
        deps.usersRepo,
        deps.passwordHasher,
        deps.outbox,
        deps.frontendBaseUrl,
        deps.notifyStudent
    );
    const loginUser = new LoginUser(
        deps.usersRepo,
        deps.passwordHasher,
        deps.tokenProvider,
        deps.tokenTtl,
        deps.activeModules,
        deps.schoolsRepo
    );
    const updateUserPassword = new UpdateUserPassword(deps.usersRepo, deps.passwordHasher);
    const refreshToken = new RefreshToken(
        deps.tokenProvider,
        deps.usersRepo,
        deps.schoolsRepo,
        deps.tokenTtl
    );
    
    // Reset de senha
    const resetTokensRepo = new PasswordResetTokenRepositoryAdapter();
    const requestUserPasswordReset = new RequestUserPasswordReset(
        deps.usersRepo, 
        resetTokensRepo, 
        deps.emailProvider,
        deps.frontendBaseUrl
    );
    const resetUserPassword = new ResetUserPassword(deps.usersRepo, resetTokensRepo, deps.passwordHasher);
    const validatePasswordResetToken = new ValidatePasswordResetToken(resetTokensRepo);

    // Montar router pronto
    const router = authRouter({
        registerUser,
        loginUser,
        refreshToken,
        updateUserPassword,
        requestUserPasswordReset,
        resetUserPassword,
        validatePasswordResetToken,
        authMiddleware: ctx.authMiddleware
    });

    return {
        deps: {
            authRouter: router
        },
        docFiles: ['auth.yaml']
    };
}
