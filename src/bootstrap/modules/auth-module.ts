import { ModuleBuildResult, ModuleSetupContext } from './types';
import { RegisterUser } from '../../app/use-cases/register-user';
import { LoginUser } from '../../app/use-cases/login-user';
import { authRouter } from '../../infra/http/routes/auth.routes';
import { ScryptPasswordHasher } from '../../infra/auth/scrypt-password-hasher';
import { HmacTokenProvider } from '../../infra/auth/hmac-token-provider';
import { UserRepositoryAdapter } from '../../infra/db/typeorm/user-repository.adap';
import type { ModuleName } from '../module-config';

export type AuthModuleDeps = {
    usersRepo: UserRepositoryAdapter;
    passwordHasher: ScryptPasswordHasher;
    tokenProvider: HmacTokenProvider;
    tokenTtl: number;
    activeModules?: readonly ModuleName[];
};

export function buildAuthModule(deps: AuthModuleDeps, _ctx: ModuleSetupContext): ModuleBuildResult {
    const registerUser = new RegisterUser(deps.usersRepo, deps.passwordHasher);
    const loginUser = new LoginUser(
        deps.usersRepo,
        deps.passwordHasher,
        deps.tokenProvider,
        deps.tokenTtl,
        deps.activeModules
    );

    return {
        deps: {
            authRouter,
            registerUser,
            loginUser
        },
        docFiles: ['auth.yaml']
    };
}
