#!/usr/bin/env tsx
import 'dotenv/config';

type CliOptions = {
    url?: string;
    event?: string;
    id?: string;
    status?: string;
    externalRef?: string;
    paymentDate?: string;
    confirmedDate?: string;
    receivedDate?: string;
    dueDate?: string;
    value?: number;
};

function parseArgs(argv: string[]): CliOptions {
    const options: Record<string, string> = {};

    for (let index = 0; index < argv.length; index++) {
        const token = argv[index];
        if (!token.startsWith('--')) continue;
        const key = token.slice(2);
        const next = argv[index + 1];
        if (next && !next.startsWith('--')) {
            options[key] = next;
            index++;
        } else {
            options[key] = 'true';
        }
    }

    const parsed: CliOptions = {};
    if (options.url) parsed.url = options.url;
    if (options.event) parsed.event = options.event;
    if (options.id) parsed.id = options.id;
    if (options.status) parsed.status = options.status;
    if (options.externalRef) parsed.externalRef = options.externalRef;
    if (options.paymentDate) parsed.paymentDate = options.paymentDate;
    if (options.confirmedDate) parsed.confirmedDate = options.confirmedDate;
    if (options.receivedDate) parsed.receivedDate = options.receivedDate;
    if (options.dueDate) parsed.dueDate = options.dueDate;
    if (options.value) {
        const numeric = Number(options.value);
        if (Number.isFinite(numeric)) {
            parsed.value = numeric;
        }
    }
    return parsed;
}

function printUsage(): void {
    // eslint-disable-next-line no-console
    console.log(`Simula um webhook de pagamento da Asaas em um ambiente local.

Opções:
  --url             URL alvo (default: ${defaultUrl()})
  --event           Evento enviado (default: PAYMENT_CONFIRMED)
  --id              ID do pagamento = provider_ref da invoice (obrigatório para bater na invoice certa)
  --status          Status do pagamento (default: RECEIVED)
  --externalRef     Referência externa
  --paymentDate     Data de pagamento (ISO 8601)
  --confirmedDate   Data de confirmação (ISO 8601)
  --receivedDate    Data de recebimento (ISO 8601)
  --dueDate         Data de vencimento (YYYY-MM-DD)
  --value           Valor do pagamento (número)

Exemplo (use o provider_ref de uma invoice ISSUED):
  npm run simulate:asaas-webhook -- --id pay_abc123xyz`);
}

function defaultUrl(): string {
    return process.env.ASAAS_WEBHOOK_URL ?? 'http://localhost:3000/integrations/asaas/payments';
}

async function main() {
    const args = process.argv.slice(2);
    if (args.includes('--help') || args.includes('-h')) {
        printUsage();
        return;
    }

    const options = parseArgs(args);
    const url = options.url ?? defaultUrl();
    const event = options.event ?? 'PAYMENT_CONFIRMED';
    const paymentId = options.id ?? `pay_${Date.now()}`;
    const status = options.status ?? 'RECEIVED';
    const now = new Date().toISOString();

    const paymentPayload: Record<string, unknown> = {
        id: paymentId,
        status
    };

    if (options.externalRef) paymentPayload.externalReference = options.externalRef;
    if (options.paymentDate) paymentPayload.paymentDate = options.paymentDate;
    else paymentPayload.paymentDate = now;
    if (options.confirmedDate) paymentPayload.confirmedDate = options.confirmedDate;
    if (options.receivedDate) paymentPayload.receivedDate = options.receivedDate;
    if (options.dueDate) paymentPayload.dueDate = options.dueDate;
    if (options.value !== undefined) paymentPayload.value = options.value;

    const body = {
        event,
        payment: paymentPayload
    };

    const headers: Record<string, string> = {
        'Content-Type': 'application/json'
    };
    const webhookToken = process.env.ASAAS_WEBHOOK_TOKEN?.trim();
    if (webhookToken) {
        headers['asaas-access-token'] = webhookToken;
    }

    // eslint-disable-next-line no-console
    console.log(`POST ${url}`);
    // eslint-disable-next-line no-console
    console.log(JSON.stringify(body, null, 2));

    const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body)
    }).catch((error) => {
        throw new Error(`Failed to call webhook endpoint: ${String(error)}`);
    });

    let responseBody: unknown = null;
    try {
        responseBody = await response.json();
    } catch (error) {
        responseBody = await response.text();
    }

    // eslint-disable-next-line no-console
    console.log(`Resposta: ${response.status}`);
    // eslint-disable-next-line no-console
    console.log(responseBody);

    if (!response.ok) {
        throw new Error(`Webhook endpoint responded with status ${response.status}`);
    }
}

main().catch((error) => {
    // eslint-disable-next-line no-console
    console.error(error);
    process.exitCode = 1;
});
