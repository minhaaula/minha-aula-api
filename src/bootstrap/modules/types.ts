import { RequestHandler } from 'express';

export type ModuleSetupContext = {
    authMiddleware: RequestHandler;
};

export type ModuleBuildResult = {
    deps: Record<string, unknown>;
    docFiles?: string[];
};

export type ModuleBuilder<TParams = any> = (params: TParams, ctx: ModuleSetupContext) => Promise<ModuleBuildResult> | ModuleBuildResult;
