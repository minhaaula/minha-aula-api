/**
 * Nome da fila BullMQ por ambiente.
 * Use OUTBOX_QUEUE_NAME no .env para isolar dev/staging do prod quando compartilham o mesmo Redis.
 * Ex.: em desenvolvimento: OUTBOX_QUEUE_NAME=outbox_development (só o worker local processa).
 * Em produção: não definir ou OUTBOX_QUEUE_NAME=outbox (padrão).
 */

export const connection = {
    host: process.env.REDIS_HOST,
    port: +(process.env.REDIS_PORT ?? 6379),
    ...(process.env.REDIS_USER ? { username: process.env.REDIS_USER } : {}),
    ...(process.env.REDIS_PASSWORD ? { password: process.env.REDIS_PASSWORD } : {}),
};

export function getOutboxQueueName(): string {
    const name = process.env.OUTBOX_QUEUE_NAME?.trim();
    return name || 'outbox';
}
