import { z } from 'zod';
import type { AppClientPlatform } from '../../../ports/repositories/user-app-client-state.repo';

export type ParsedLoginAppClient = {
    platform: AppClientPlatform;
    appVersion: string;
    osVersion: string;
    notificationsEnabled: boolean;
};

const appClientCoreSchema = z.object({
    platform: z.preprocess(
        (value) => (typeof value === 'string' ? value.trim().toUpperCase() : value),
        z.enum(['ANDROID', 'IOS'])
    ),
    appVersion: z.string().trim().min(1).max(32),
    osVersion: z.string().trim().min(1).max(64),
    /** Opcional no app; quando omitido, assume `false`. */
    notificationsEnabled: z.coerce.boolean().optional().default(false)
});

type RawAppClientFields = {
    platform?: unknown;
    appVersion?: unknown;
    app_version?: unknown;
    osVersion?: unknown;
    os_version?: unknown;
    notificationsEnabled?: unknown;
    notifications_enabled?: unknown;
};

function pickRawAppClientFields(raw: RawAppClientFields | null | undefined): RawAppClientFields | null {
    if (!raw || typeof raw !== 'object') {
        return null;
    }

    const platform = raw.platform;
    const appVersion = raw.appVersion ?? raw.app_version;
    const osVersion = raw.osVersion ?? raw.os_version;
    const notificationsEnabled = raw.notificationsEnabled ?? raw.notifications_enabled;

    const values = [platform, appVersion, osVersion, notificationsEnabled];
    if (values.every((value) => value === undefined)) {
        return null;
    }

    return { platform, appVersion, osVersion, notificationsEnabled };
}

/**
 * Aceita metadados do app no login em formato plano (`platform`, `appVersion`, …)
 * ou aninhado (`appClient: { … }`), com aliases snake_case.
 */
export function parseLoginAppClient(body: {
    platform?: unknown;
    appVersion?: unknown;
    app_version?: unknown;
    osVersion?: unknown;
    os_version?: unknown;
    notificationsEnabled?: unknown;
    notifications_enabled?: unknown;
    appClient?: RawAppClientFields | null;
}): ParsedLoginAppClient | undefined {
    const nested = pickRawAppClientFields(body.appClient);
    const flat = pickRawAppClientFields(body);
    const merged: RawAppClientFields = {
        ...(flat ?? {}),
        ...(nested ?? {})
    };

    const platform = merged.platform;
    const appVersion = merged.appVersion;
    const osVersion = merged.osVersion;
    const notificationsEnabled = merged.notificationsEnabled;

    const coreFields = [platform, appVersion, osVersion];
    const anyCore = coreFields.some((value) => value !== undefined);
    const allCore = coreFields.every((value) => value !== undefined);

    if (!anyCore && notificationsEnabled === undefined) {
        return undefined;
    }

    if (anyCore && !allCore) {
        throw new z.ZodError([
            {
                code: 'custom',
                message:
                    'Informe platform, appVersion e osVersion juntos para registrar o app do aluno.',
                path: ['platform']
            }
        ]);
    }

    const parsed = appClientCoreSchema.safeParse({
        platform,
        appVersion,
        osVersion,
        notificationsEnabled
    });

    if (!parsed.success) {
        const issue = parsed.error.issues[0];
        throw new z.ZodError([
            {
                code: 'custom',
                message: issue?.message ?? 'Metadados do app inválidos.',
                path: issue?.path?.length ? issue.path : ['platform']
            }
        ]);
    }

    return parsed.data;
}

/** @deprecated use parseLoginAppClient */
export const loginAppClientSchema = z
    .object({
        platform: z.enum(['ANDROID', 'IOS']),
        appVersion: z.string().trim().min(1).max(32),
        osVersion: z.string().trim().min(1).max(64),
        notificationsEnabled: z.boolean()
    })
    .optional();

export type LoginAppClientInput = z.infer<typeof loginAppClientSchema>;
