import { SchoolRepository } from '../../../ports/repositories/school.repo';
import {
    SchoolAccountStatusSnapshot,
    schoolAccountStatusSectionsEqual
} from '../../../domain/entities/school';
import { log } from '../../../shared/logger';

type AsaasAccountPayload = {
    id?: string | null;
    ownerId?: string | null;
    status?: string | null;
    externalReference?: string | null;
    name?: string | null;
    email?: string | null;
    cpfCnpj?: string | null;
    personType?: string | null;
    companyType?: string | null;
    dateCreated?: string | null;
    dateUpdated?: string | null;
    apiKey?: string | null;
    walletId?: string | null;
};

type AsaasAccountStatusPayload = {
    id?: string | null;
    commercialInfo?: string | null;
    bankAccountInfo?: string | null;
    documentation?: string | null;
    general?: string | null;
};

type HandleAsaasAccountWebhookInput = {
    event: string;
    account?: AsaasAccountPayload | null;
    /**
     * Subobjeto `accountStatus` enviado pelo Asaas em eventos `ACCOUNT_STATUS_*`.
     * Reflete o resultado da consulta de situação cadastral por etapa do KYC.
     */
    accountStatus?: AsaasAccountStatusPayload | null;
    eventId?: string | null;
    /** Data/hora de criação do evento informada pelo Asaas (ex.: "2026-05-03 15:29:46"). */
    eventCreatedAt?: string | null;
};

type HandleAsaasAccountWebhookOutput = {
    handled: boolean;
    reason?: string;
};

/** Único evento que sinaliza a aprovação **geral** do KYC e habilita a escola para operar. */
const ACTIVATES_ACCOUNT_EVENT = 'ACCOUNT_STATUS_GENERAL_APPROVAL_APPROVED';

const KNOWN_ACCOUNT_STATUS_EVENTS: ReadonlySet<string> = new Set([
    'ACCOUNT_STATUS_GENERAL_APPROVAL_APPROVED',
    'ACCOUNT_STATUS_GENERAL_APPROVAL_REJECTED',
    'ACCOUNT_STATUS_GENERAL_APPROVAL_AWAITING_APPROVAL',
    'ACCOUNT_STATUS_GENERAL_APPROVAL_PENDING',
    'ACCOUNT_STATUS_BANK_ACCOUNT_INFO_APPROVED',
    'ACCOUNT_STATUS_BANK_ACCOUNT_INFO_AWAITING_APPROVAL',
    'ACCOUNT_STATUS_BANK_ACCOUNT_INFO_PENDING',
    'ACCOUNT_STATUS_BANK_ACCOUNT_INFO_REJECTED',
    'ACCOUNT_STATUS_COMMERCIAL_INFO_APPROVED',
    'ACCOUNT_STATUS_COMMERCIAL_INFO_AWAITING_APPROVAL',
    'ACCOUNT_STATUS_COMMERCIAL_INFO_PENDING',
    'ACCOUNT_STATUS_COMMERCIAL_INFO_REJECTED',
    'ACCOUNT_STATUS_COMMERCIAL_INFO_EXPIRING_SOON',
    'ACCOUNT_STATUS_COMMERCIAL_INFO_EXPIRED',
    'ACCOUNT_STATUS_DOCUMENT_APPROVED',
    'ACCOUNT_STATUS_DOCUMENT_AWAITING_APPROVAL',
    'ACCOUNT_STATUS_DOCUMENT_PENDING',
    'ACCOUNT_STATUS_DOCUMENT_REJECTED',
    'ACCOUNT_CREATED',
    'ACCOUNT_APPROVED',
    'ACCOUNT_REJECTED',
    'ACCOUNT_PENDING',
    'ACCOUNT_AWAITING_APPROVAL'
]);

export class HandleAsaasAccountWebhook {
    constructor(private readonly schools: SchoolRepository) {}

    async exec(input: HandleAsaasAccountWebhookInput): Promise<HandleAsaasAccountWebhookOutput> {
        const eventName = input.event?.toUpperCase?.() ?? '';
        const account = input.account ?? null;
        const accountStatus = input.accountStatus ?? null;
        const eventCreatedAt = input.eventCreatedAt ?? null;

        if (!account && !accountStatus) {
            return { handled: false, reason: 'Missing account payload' };
        }

        const accountId = account?.id?.trim() || null;
        const externalReference = account?.externalReference?.trim() || null;

        let school = null;
        if (externalReference) {
            school = await this.schools.findById(externalReference);
        }
        if (!school && accountId) {
            if (this.schools.findByAccountId) {
                school = await this.schools.findByAccountId(accountId);
            } else {
                // Fallback defensivo: implementações de teste que não exponham findByAccountId.
                const all = await this.schools.findAll();
                school = all.find((s) => s.accountId === accountId) ?? null;
            }
        }

        if (!school) {
            log.warn('[Asaas Webhook] Escola não encontrada para o webhook de conta', {
                event: eventName,
                externalReference,
                accountId
            });
            return { handled: false, reason: 'School not found for account' };
        }

        let updatedSchool = school;
        let needsUpdate = false;

        // Idempotência por data do evento: se já processamos um evento mais novo, ignoramos patches do snapshot.
        // Observação: o Asaas pode reenviar múltiplos eventos no mesmo segundo; nesse caso aceitamos o merge pois é idempotente.
        const currentSnapshotAtMs = (() => {
            const currentAt = school.accountStatusSnapshot?.lastEventAt?.trim();
            if (!currentAt) return null;
            const ms = Date.parse(currentAt);
            return Number.isNaN(ms) ? null : ms;
        })();
        const incomingSnapshotAtMs = (() => {
            const parsed = HandleAsaasAccountWebhook.parseAsaasDateTime(eventCreatedAt);
            return parsed ? parsed.getTime() : null;
        })();
        const shouldApplySnapshotPatch =
            currentSnapshotAtMs === null ||
            incomingSnapshotAtMs === null ||
            incomingSnapshotAtMs >= currentSnapshotAtMs;

        if (accountId && !school.accountId) {
            updatedSchool = updatedSchool.withAccountId(accountId);
            needsUpdate = true;
        }

        if (account?.apiKey && account.apiKey.trim() && !school.accountApiKey) {
            updatedSchool = updatedSchool.withAccountApiKey(account.apiKey.trim());
            needsUpdate = true;
        }

        if (account?.walletId && account.walletId.trim() && !school.walletId) {
            updatedSchool = updatedSchool.withWalletId(account.walletId.trim());
            needsUpdate = true;
        }

        const snapshotPatch = shouldApplySnapshotPatch
            ? this.buildSnapshotPatch(eventName, accountStatus, eventCreatedAt)
            : null;
        if (!shouldApplySnapshotPatch && KNOWN_ACCOUNT_STATUS_EVENTS.has(eventName)) {
            return { handled: true, reason: 'Ignored older duplicate account status event' };
        }
        /**
         * Persistir snapshot na primeira vez (bootstrap) ou quando um dos quatro pilares mudar.
         * Evita regravar lastEvent/lastEventAt em reenvios do Asaas com o mesmo status cadastral.
         */
        let accountSnapshotPersisted = false;
        if (snapshotPatch && shouldApplySnapshotPatch) {
            const beforeSnap = updatedSchool.accountStatusSnapshot;
            const afterSchool = updatedSchool.withAccountStatusSnapshot(snapshotPatch);
            const sectionsChanged = !schoolAccountStatusSectionsEqual(
                beforeSnap,
                afterSchool.accountStatusSnapshot
            );
            const bootstrapSnapshot = beforeSnap == null;
            if (sectionsChanged || bootstrapSnapshot) {
                updatedSchool = afterSchool;
                needsUpdate = true;
                accountSnapshotPersisted = true;
            }
        }

        if (eventName === ACTIVATES_ACCOUNT_EVENT && !school.onboardingCompletedAt) {
            updatedSchool = updatedSchool.withOnboardingCompletedAt(new Date());
            needsUpdate = true;
        }

        if (needsUpdate) {
            await this.schools.save(updatedSchool);
        }

        if (eventName === ACTIVATES_ACCOUNT_EVENT) {
            log.info('[Asaas Webhook] Conta ativada (aprovação geral)', {
                event: eventName,
                schoolId: updatedSchool.id,
                accountId
            });
            return { handled: true, reason: 'Account approved' };
        }

        if (KNOWN_ACCOUNT_STATUS_EVENTS.has(eventName)) {
            return {
                handled: true,
                reason: accountSnapshotPersisted ? 'Account status updated' : 'Account status unchanged'
            };
        }

        return { handled: true, reason: 'Event not processed' };
    }

    /**
     * Monta o patch de snapshot a partir de:
     * - `accountStatus` (quando o Asaas envia o objeto granular do KYC)
     * - `eventName` (sempre presente; usado para inferir a etapa quando `accountStatus` está ausente)
     *
     * Retorna `null` quando não há nada para atualizar.
     */
    private buildSnapshotPatch(
        eventName: string,
        accountStatus: AsaasAccountStatusPayload | null,
        eventCreatedAt: string | null
    ): SchoolAccountStatusSnapshot | null {
        const patch: SchoolAccountStatusSnapshot = {};
        let hasAny = false;

        if (accountStatus) {
            const map: Array<[keyof AsaasAccountStatusPayload, keyof SchoolAccountStatusSnapshot]> = [
                ['commercialInfo', 'commercialInfo'],
                ['bankAccountInfo', 'bankAccountInfo'],
                ['documentation', 'documentation'],
                ['general', 'general']
            ];
            for (const [src, dest] of map) {
                const v = accountStatus[src];
                if (typeof v === 'string' && v.trim()) {
                    patch[dest] = v.trim().toUpperCase();
                    hasAny = true;
                }
            }
        }

        // Inferência por evento — útil em cenários onde o Asaas não inclui `accountStatus` no payload.
        const inferred = this.inferStatusFromEvent(eventName);
        if (inferred) {
            const [section, status] = inferred;
            if (!patch[section]) {
                patch[section] = status;
                hasAny = true;
            }
        }

        if (eventName) {
            patch.lastEvent = eventName;
            patch.lastEventAt = (HandleAsaasAccountWebhook.parseAsaasDateTime(eventCreatedAt) ?? new Date()).toISOString();
            hasAny = true;
        }

        return hasAny ? patch : null;
    }

    private inferStatusFromEvent(
        eventName: string
    ): [keyof SchoolAccountStatusSnapshot, string] | null {
        if (!eventName.startsWith('ACCOUNT_STATUS_')) return null;
        const sectionMap: Array<[string, keyof SchoolAccountStatusSnapshot]> = [
            ['BANK_ACCOUNT_INFO', 'bankAccountInfo'],
            ['COMMERCIAL_INFO', 'commercialInfo'],
            ['DOCUMENT', 'documentation'],
            ['GENERAL_APPROVAL', 'general']
        ];
        const statusOptions = ['APPROVED', 'AWAITING_APPROVAL', 'PENDING', 'REJECTED', 'EXPIRING_SOON', 'EXPIRED'];
        for (const [prefix, key] of sectionMap) {
            for (const status of statusOptions) {
                if (eventName === `ACCOUNT_STATUS_${prefix}_${status}`) {
                    return [key, status];
                }
            }
        }
        return null;
    }

    /**
     * Parse do formato do Asaas: "YYYY-MM-DD HH:mm:ss" (sem timezone).
     * Estratégia: tratar como horário local do servidor.
     */
    private static parseAsaasDateTime(value: string | null): Date | null {
        if (!value) return null;
        const trimmed = value.trim();
        if (!trimmed) return null;
        const m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})$/.exec(trimmed);
        if (!m) return null;
        const year = Number(m[1]);
        const month = Number(m[2]) - 1;
        const day = Number(m[3]);
        const hour = Number(m[4]);
        const minute = Number(m[5]);
        const second = Number(m[6]);
        const d = new Date(year, month, day, hour, minute, second);
        return Number.isNaN(d.getTime()) ? null : d;
    }
}
