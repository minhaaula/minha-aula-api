import { SchoolRepository } from '../../ports/repositories/school.repo';

type AsaasAccountPayload = {
    id?: string | null;
    status?: string | null;
    externalReference?: string | null;
    name?: string | null;
    email?: string | null;
    cpfCnpj?: string | null;
    personType?: string | null;
    companyType?: string | null;
    dateCreated?: string | null;
    dateUpdated?: string | null;
};

type HandleAsaasAccountWebhookInput = {
    event: string;
    account?: AsaasAccountPayload | null;
    eventId?: string | null; // ID do evento do Asaas para idempotência
};

type HandleAsaasAccountWebhookOutput = {
    handled: boolean;
    reason?: string;
};

// Eventos de aprovação de conta
const APPROVED_EVENTS = new Set([
    'ACCOUNT_STATUS_GENERAL_APPROVAL_APPROVED',
    'ACCOUNT_CREATED',
    'ACCOUNT_APPROVED'
]);

// Eventos de rejeição
const REJECTED_EVENTS = new Set([
    'ACCOUNT_STATUS_GENERAL_APPROVAL_REJECTED',
    'ACCOUNT_REJECTED'
]);

// Eventos de análise/pendente
const PENDING_EVENTS = new Set([
    'ACCOUNT_STATUS_GENERAL_APPROVAL_AWAITING_APPROVAL',
    'ACCOUNT_STATUS_GENERAL_APPROVAL_PENDING',
    'ACCOUNT_PENDING',
    'ACCOUNT_AWAITING_APPROVAL'
]);

export class HandleAsaasAccountWebhook {
    constructor(
        private readonly schools: SchoolRepository
    ) {}

    async exec(input: HandleAsaasAccountWebhookInput): Promise<HandleAsaasAccountWebhookOutput> {
        const eventName = input.event?.toUpperCase?.() ?? '';
        const account = input.account;

        if (!account) {
            return { handled: false, reason: 'Missing account payload' };
        }

        // Buscar escola pelo externalReference (que é o ID da escola) ou pelo accountId
        let school = null;
        
        if (account.externalReference) {
            school = await this.schools.findById(account.externalReference);
        } else if (account.id) {
            // Se não tiver externalReference, buscar pelo accountId
            const allSchools = await this.schools.findAll();
            school = allSchools.find(s => s.accountId === account.id) ?? null;
        }

        if (!school) {
            return { handled: false, reason: 'School not found for account' };
        }

        // Idempotência básica: verificar se o evento já foi processado
        // (para webhooks de conta, a idempotência é menos crítica pois não alteram estado crítico)
        // Mas ainda é útil para evitar logs duplicados
        if (input.eventId) {
            // Podemos armazenar eventos processados no metadata da escola se necessário
            // Por enquanto, apenas processamos normalmente
        }

        // Processar evento de aprovação
        if (APPROVED_EVENTS.has(eventName)) {
            // Atualizar status da conta na escola (se necessário)
            // Por enquanto, apenas logamos que a conta foi aprovada
            // O accountId já está salvo quando a conta é criada
            return { handled: true, reason: 'Account approved' };
        }

        // Processar evento de rejeição
        if (REJECTED_EVENTS.has(eventName)) {
            // Logar rejeição - pode ser útil para notificações
            return { handled: true, reason: 'Account rejected' };
        }

        // Processar evento de pendente/em análise
        if (PENDING_EVENTS.has(eventName)) {
            return { handled: true, reason: 'Account pending approval' };
        }

        // Evento não reconhecido, mas retornamos handled: true para não gerar erro no Asaas
        return { handled: true, reason: 'Event not processed' };
    }
}

