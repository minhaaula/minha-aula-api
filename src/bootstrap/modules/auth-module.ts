import { ModuleBuildResult, ModuleSetupContext } from './types';
import { RegisterUser } from '../../app/use-cases/auth/register-user';
import { LoginUser } from '../../app/use-cases/auth/login-user';
import { RefreshToken } from '../../app/use-cases/auth/refresh-token';
import { authRouter } from '../../infra/http/routes/auth.routes';
import { ScryptPasswordHasher } from '../../infra/auth/scrypt-password-hasher';
import { HmacTokenProvider } from '../../infra/auth/hmac-token-provider';
import { UserRepositoryAdapter } from '../../infra/db/typeorm/user-repository.adapter';
import { SchoolRepositoryAdapter } from '../../infra/db/typeorm/school-repository';
import { MODULE_DOC_FILES, type ModuleName } from '../module-config';
import { UpdateUserPassword } from '../../app/use-cases/auth/update-user-password';
import { ResetUserPassword } from '../../app/use-cases/auth/reset-user-password';
import { ValidatePasswordResetToken } from '../../app/use-cases/auth/validate-password-reset-token';
import { PasswordResetTokenRepositoryAdapter } from '../../infra/db/typeorm/password-reset-token-repository.adapter';
import { AuthPhoneOtpChallengeRepositoryAdapter } from '../../infra/db/typeorm/auth-phone-otp-challenge-repository.adapter';
import { createTwilioVerifyFromEnv } from '../../infra/providers/twilio/create-twilio-verify-provider';
import { RequestPhoneOtpChallenge } from '../../app/use-cases/auth/request-phone-otp-challenge';
import { VerifyPhoneOtpChallenge } from '../../app/use-cases/auth/verify-phone-otp-challenge';
import { EmailProviderPort } from '../../ports/providers/email-provider.port';
import type { OutboxRepository } from '../../ports/repositories/outbox.repo';
import type { NotifyStudentUser } from '../../app/use-cases/shared/notify-student-user';
import { UserAppClientStateRepositoryAdapter } from '../../infra/db/typeorm/user-app-client-state-repository.adapter';

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
    const resetTokensRepo = new PasswordResetTokenRepositoryAdapter();
    const authPhoneOtpRepo = new AuthPhoneOtpChallengeRepositoryAdapter();
    const twilioVerify = createTwilioVerifyFromEnv();
    const requestPhoneOtp = new RequestPhoneOtpChallenge(
        authPhoneOtpRepo,
        twilioVerify,
        deps.usersRepo,
        undefined,
        deps.outbox
    );
    const verifyPhoneOtp = new VerifyPhoneOtpChallenge(authPhoneOtpRepo, twilioVerify, deps.tokenProvider, resetTokensRepo);

    const registerUser = new RegisterUser(
        deps.usersRepo,
        deps.passwordHasher,
        deps.tokenProvider,
        deps.outbox,
        deps.frontendBaseUrl,
        deps.notifyStudent
    );
    const appClientStateRepo = new UserAppClientStateRepositoryAdapter();
    const loginUser = new LoginUser(
        deps.usersRepo,
        deps.passwordHasher,
        deps.tokenProvider,
        deps.tokenTtl,
        deps.activeModules,
        deps.schoolsRepo,
        appClientStateRepo
    );
    const updateUserPassword = new UpdateUserPassword(deps.usersRepo, deps.passwordHasher);
    const refreshToken = new RefreshToken(
        deps.tokenProvider,
        deps.usersRepo,
        deps.schoolsRepo,
        deps.tokenTtl,
        appClientStateRepo
    );

    const resetUserPassword = new ResetUserPassword(deps.usersRepo, resetTokensRepo, deps.passwordHasher);
    const validatePasswordResetToken = new ValidatePasswordResetToken(resetTokensRepo);

    const router = authRouter({
        registerUser,
        loginUser,
        refreshToken,
        updateUserPassword,
        requestPhoneOtp,
        verifyPhoneOtp,
        resetUserPassword,
        validatePasswordResetToken,
        authMiddleware: ctx.authMiddleware
    });

    return {
        deps: {
            authRouter: router
        },
        docFiles: [...MODULE_DOC_FILES.auth]
    };
}
