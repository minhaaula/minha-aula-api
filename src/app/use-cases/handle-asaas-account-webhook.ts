import { SchoolRepository } from '../../ports/repositories/school.repo';
import { log } from '../../shared/logger';

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
    apiKey?: string | null; // API Key da conta
    walletId?: string | null; // Wallet ID da conta
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

/** Evento que ativa a conta da escola: marca onboarding como completo e persiste apiKey/walletId se vier no payload. */
const ACTIVATES_ACCOUNT_EVENT = 'ACCOUNT_STATUS_GENERAL_APPROVAL_APPROVED';

// Eventos de aprovação de conta (o único enviado pelo Asaas ao aprovar KYC é ACCOUNT_STATUS_GENERAL_APPROVAL_APPROVED)
const APPROVED_EVENTS = new Set([
    ACTIVATES_ACCOUNT_EVENT,
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
            log.warn('[Asaas Webhook] Escola não encontrada para o webhook de conta', {
                event: eventName,
                externalReference: account.externalReference ?? null,
                accountId: account.id ?? null
            });
            return { handled: false, reason: 'School not found for account' };
        }

        // Só ativa a conta (onboardingCompletedAt) quando o evento for aprovação geral
        if (eventName === ACTIVATES_ACCOUNT_EVENT) {
            let needsUpdate = false;
            let updatedSchool = school;
            
            // Atualizar accountId se ainda não estiver salvo
            if (account.id && !school.accountId) {
                updatedSchool = updatedSchool.withAccountId(account.id);
                needsUpdate = true;
            }
            
            // Se o webhook trouxer o apiKey, salvar também
            if (account.apiKey && account.apiKey.trim() && !school.accountApiKey) {
                updatedSchool = updatedSchool.withAccountApiKey(account.apiKey.trim());
                needsUpdate = true;
            }
            
            // Se o webhook trouxer o walletId, salvar também
            if (account.walletId && account.walletId.trim() && !school.walletId) {
                updatedSchool = updatedSchool.withWalletId(account.walletId.trim());
                needsUpdate = true;
            }
            
            // Marcar onboarding como completo quando receber o webhook de aprovação
            if (!school.onboardingCompletedAt) {
                updatedSchool = updatedSchool.withOnboardingCompletedAt(new Date());
                needsUpdate = true;
            }
            
            if (needsUpdate) {
                await this.schools.save(updatedSchool);
                log.info('[Asaas Webhook] Conta ativada: onboarding marcado como completo', {
                    event: eventName,
                    schoolId: updatedSchool.id,
                    accountId: account.id ?? null
                });
                return { handled: true, reason: 'Account approved and saved' };
            }
            
            // Se já tem accountId mas não tem apiKey/walletId e o webhook trouxer, atualizar
            if (account.id && school.accountId === account.id) {
                let partialUpdate = false;
                let partialUpdatedSchool = school;
                
                if (account.apiKey && account.apiKey.trim() && !school.accountApiKey) {
                    partialUpdatedSchool = partialUpdatedSchool.withAccountApiKey(account.apiKey.trim());
                    partialUpdate = true;
                }
                
                if (account.walletId && account.walletId.trim() && !school.walletId) {
                    partialUpdatedSchool = partialUpdatedSchool.withWalletId(account.walletId.trim());
                    partialUpdate = true;
                }
                
                if (partialUpdate) {
                    await this.schools.save(partialUpdatedSchool);
                    return { handled: true, reason: 'Account API key or wallet ID saved' };
                }
            }
            
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

