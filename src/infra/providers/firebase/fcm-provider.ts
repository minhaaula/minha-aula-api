import admin from 'firebase-admin';

function parseServiceAccount(): admin.ServiceAccount {
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    if (!raw) {
        throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON is required to send FCM push notifications');
    }

    try {
        const parsed = JSON.parse(raw);
        return parsed as admin.ServiceAccount;
    } catch (e) {
        throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON must be a valid JSON string');
    }
}

let app: admin.app.App | null = null;

export function getFirebaseAdminApp(): admin.app.App {
    if (app) return app;
    if (admin.apps.length) {
        app = admin.app();
        return app;
    }

    const credential = admin.credential.cert(parseServiceAccount());
    app = admin.initializeApp({ credential });
    return app;
}

export async function sendFcmMulticast(input: {
    tokens: string[];
    title: string;
    body: string;
    data?: Record<string, string>;
}): Promise<{
    successCount: number;
    failureCount: number;
    invalidTokens: string[];
}> {
    if (!input.tokens.length) {
        return { successCount: 0, failureCount: 0, invalidTokens: [] };
    }

    const messaging = getFirebaseAdminApp().messaging();
    const resp = await messaging.sendEachForMulticast({
        tokens: input.tokens,
        notification: { title: input.title, body: input.body },
        data: input.data
    });

    const invalidTokens: string[] = [];
    resp.responses.forEach((r, idx) => {
        if (r.success) return;
        const code = (r.error as any)?.code as string | undefined;
        if (code === 'messaging/registration-token-not-registered' || code === 'messaging/invalid-registration-token') {
            invalidTokens.push(input.tokens[idx]);
        }
    });

    return {
        successCount: resp.successCount,
        failureCount: resp.failureCount,
        invalidTokens
    };
}

