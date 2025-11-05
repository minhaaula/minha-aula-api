import { ModuleBuildResult, ModuleSetupContext } from './types';
import { RegisterUser } from '../../app/use-cases/register-user';
import { LoginUser } from '../../app/use-cases/login-user';
import { authRouter } from '../../infra/http/routes/auth.routes';
import { ScryptPasswordHasher } from '../../infra/auth/scrypt-password-hasher';
import { HmacTokenProvider } from '../../infra/auth/hmac-token-provider';
import { UserRepositoryAdapter } from '../../infra/db/typeorm/user-repository.adapter';
import { SchoolRepositoryAdapter } from '../../infra/db/typeorm/school-repository.adapter';
import type { ModuleName } from '../module-config';
import { UpdateUserPassword } from '../../app/use-cases/update-user-password';

export type AuthModuleDeps = {
    usersRepo: UserRepositoryAdapter;
    passwordHasher: ScryptPasswordHasher;
    tokenProvider: HmacTokenProvider;
    tokenTtl: number;
    activeModules?: readonly ModuleName[];
    schoolsRepo: SchoolRepositoryAdapter;
};

export function buildAuthModule(deps: AuthModuleDeps, ctx: ModuleSetupContext): ModuleBuildResult {
    const registerUser = new RegisterUser(deps.usersRepo, deps.passwordHasher);
    const loginUser = new LoginUser(
        deps.usersRepo,
        deps.passwordHasher,
        deps.tokenProvider,
        deps.tokenTtl,
        deps.activeModules,
        deps.schoolsRepo
    );
    const updateUserPassword = new UpdateUserPassword(deps.usersRepo, deps.passwordHasher);

    // Montar router pronto
    const router = authRouter({
        registerUser,
        loginUser,
        updateUserPassword,
        authMiddleware: ctx.authMiddleware
    });

    return {
        deps: {
            authRouter: router
        },
        docFiles: ['auth.yaml']
    };
}
