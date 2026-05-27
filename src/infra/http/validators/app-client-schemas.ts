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
    devicePlatform?: unknown;
    device_platform?: unknown;
    appVersion?: unknown;
    app_version?: unknown;
    version?: unknown;
    build?: unknown;
    buildNumber?: unknown;
    osVersion?: unknown;
    os_version?: unknown;
    os?: unknown;
    systemVersion?: unknown;
    operatingSystemVersion?: unknown;
    notificationsEnabled?: unknown;
    notifications_enabled?: unknown;
};

const NESTED_APP_CLIENT_KEYS = [
    'appClient',
    'device',
    'mobile',
    'client',
    'deviceInfo',
    'meta',
    'app'
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function pickRawAppClientFields(raw: RawAppClientFields | null | undefined): RawAppClientFields | null {
    if (!raw || typeof raw !== 'object') {
        return null;
    }

    const platform = raw.platform ?? raw.devicePlatform ?? raw.device_platform;
    const appVersion =
        raw.appVersion ?? raw.app_version ?? raw.version ?? raw.buildNumber ?? raw.build;
    const osVersion =
        raw.osVersion ??
        raw.os_version ??
        raw.os ??
        raw.systemVersion ??
        raw.operatingSystemVersion;
    const notificationsEnabled = raw.notificationsEnabled ?? raw.notifications_enabled;

    const values = [platform, appVersion, osVersion, notificationsEnabled];
    if (values.every((value) => value === undefined)) {
        return null;
    }

    return { platform, appVersion, osVersion, notificationsEnabled };
}

function mergeRawAppClientFields(sources: RawAppClientFields[]): RawAppClientFields {
    const merged: RawAppClientFields = {};
    for (const source of sources) {
        if (source.platform !== undefined) merged.platform = source.platform;
        if (source.appVersion !== undefined) merged.appVersion = source.appVersion;
        if (source.osVersion !== undefined) merged.osVersion = source.osVersion;
        if (source.notificationsEnabled !== undefined) {
            merged.notificationsEnabled = source.notificationsEnabled;
        }
    }
    return merged;
}

function collectAppClientSources(body: unknown): RawAppClientFields[] {
    if (!isRecord(body)) {
        return [];
    }

    const sources: RawAppClientFields[] = [];
    const root = pickRawAppClientFields(body as RawAppClientFields);
    if (root) {
        sources.push(root);
    }

    for (const key of NESTED_APP_CLIENT_KEYS) {
        const nested = body[key];
        if (!isRecord(nested)) {
            continue;
        }
        const picked = pickRawAppClientFields(nested as RawAppClientFields);
        if (picked) {
            sources.push(picked);
        }
    }

    return sources;
}

/**
 * Aceita metadados do app no login/refresh em formato plano, aninhado (`appClient`, `device`, …)
 * ou com aliases (`app_version`, `version`, `os`, etc.).
 */
export function parseLoginAppClient(body: unknown): ParsedLoginAppClient | undefined {
    const sources = collectAppClientSources(body);
    if (sources.length === 0) {
        return undefined;
    }

    const merged = mergeRawAppClientFields(sources);
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
