import type { School } from '../../domain/entities/school';

/**
 * Visão administrativa do status da subconta Asaas, derivada apenas de dados persistidos
 * (sem chamada à API do Asaas — adequado para listagens com muitas escolas).
 */
export type AdminSchoolAsaasAccountView = {
    accountId: string;
    commercialInfo: string;
    bankAccountInfo: string;
    documentation: string;
    general: string;
    onboardingCompleted: boolean;
    onboardingCompletedAt: Date | null;
    lastEvent: string | null;
    lastEventAt: string | null;
    /** Problemas detectados (rejeição, expirado, etc.), em português. */
    issues: string[];
    /** Texto único para exibição rápida; ausente quando não há pendências de erro. */
    summary: string | null;
};

const pillarLabels = {
    commercialInfo: 'Dados comerciais',
    bankAccountInfo: 'Conta bancária (recebimentos)',
    documentation: 'Documentação (KYC)',
    general: 'Aprovação geral da conta'
} as const;

type PillarKey = keyof typeof pillarLabels;

function pillarHasIssue(status: string): boolean {
    const u = status.toUpperCase();
    return (
        u.includes('REJECT') ||
        u.includes('EXPIRED') ||
        u.includes('EXPIRING') ||
        u === 'FAILED'
    );
}

function describePillarIssue(pillar: PillarKey, status: string): string {
    const label = pillarLabels[pillar];
    const u = status.toUpperCase();
    if (u.includes('REJECT')) {
        return `${label}: rejeitado pelo Asaas.`;
    }
    if (u.includes('EXPIRED')) {
        return `${label}: expirado ou inválido; regularize no Asaas.`;
    }
    if (u.includes('EXPIRING')) {
        return `${label}: próximo do vencimento; atualize no Asaas.`;
    }
    if (u === 'FAILED') {
        return `${label}: falha na verificação.`;
    }
    return `${label}: situação irregular (${status}).`;
}

function hintFromLastEvent(raw: string | null | undefined): string | null {
    const ev = raw?.trim();
    if (!ev) return null;
    const e = ev.toUpperCase();
    if (e.includes('DOCUMENT') && e.includes('REJECT')) {
        return 'Último evento Asaas: documentação rejeitada.';
    }
    if (e.includes('BANK') && e.includes('REJECT')) {
        return 'Último evento Asaas: dados bancários rejeitados.';
    }
    if (e.includes('COMMERCIAL') && e.includes('REJECT')) {
        return 'Último evento Asaas: dados comerciais rejeitados.';
    }
    if (e.includes('GENERAL') && e.includes('REJECT')) {
        return 'Último evento Asaas: aprovação geral rejeitada.';
    }
    if (e.includes('EXPIRED')) {
        return 'Último evento Asaas: cadastro comercial expirado ou a vencer.';
    }
    return null;
}

/**
 * Monta a visão admin a partir da entidade escola. Retorna `null` se não houver `accountId`.
 */
export function presentAdminSchoolAsaasAccountFromSchool(school: School): AdminSchoolAsaasAccountView | null {
    const accountId = school.accountId?.trim();
    if (!accountId) {
        return null;
    }

    const onboardingCompleted = school.onboardingCompletedAt !== null;
    const snap = school.accountStatusSnapshot;

    let commercialInfo: string;
    let bankAccountInfo: string;
    let documentation: string;
    let general: string;

    if (onboardingCompleted) {
        commercialInfo = 'APPROVED';
        bankAccountInfo = 'APPROVED';
        documentation = 'APPROVED';
        general = 'APPROVED';
    } else {
        commercialInfo = snap?.commercialInfo?.trim() || 'PENDING';
        bankAccountInfo = snap?.bankAccountInfo?.trim() || 'PENDING';
        documentation = snap?.documentation?.trim() || 'PENDING';
        general = snap?.general?.trim() || 'PENDING';
    }

    const lastEvent = snap?.lastEvent?.trim() || null;
    const lastEventAt = snap?.lastEventAt?.trim() || null;

    const issues: string[] = [];
    if (!onboardingCompleted) {
        const pillars: Array<[PillarKey, string]> = [
            ['commercialInfo', commercialInfo],
            ['bankAccountInfo', bankAccountInfo],
            ['documentation', documentation],
            ['general', general]
        ];
        for (const [key, st] of pillars) {
            if (pillarHasIssue(st)) {
                issues.push(describePillarIssue(key, st));
            }
        }
        const eventHint = hintFromLastEvent(lastEvent);
        if (eventHint && !issues.includes(eventHint)) {
            const lowerHint = eventHint.toLowerCase();
            const hintRedundant = issues.some((issue) => {
                const li = issue.toLowerCase();
                return (
                    (lowerHint.includes('documentação') && li.includes('documentação')) ||
                    (lowerHint.includes('bancários') && li.includes('conta bancária')) ||
                    (lowerHint.includes('comerciais') && li.includes('comerciais')) ||
                    (lowerHint.includes('aprovação geral') && li.includes('aprovação geral'))
                );
            });
            if (!hintRedundant) {
                issues.push(eventHint);
            }
        }
    }

    const summary = issues.length > 0 ? issues.join(' ') : null;

    return {
        accountId,
        commercialInfo,
        bankAccountInfo,
        documentation,
        general,
        onboardingCompleted,
        onboardingCompletedAt: school.onboardingCompletedAt,
        lastEvent,
        lastEventAt,
        issues,
        summary
    };
}
