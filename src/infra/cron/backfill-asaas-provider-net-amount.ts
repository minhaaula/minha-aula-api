import 'dotenv/config';
import { IsNull } from 'typeorm';
import { AppDataSource } from '../db/typeorm/datasource';
import { SchoolFinancialChargeOrm } from '../db/typeorm/entities/school-financial-charge.orm';
import { SchoolOrm } from '../db/typeorm/entities/school.orm';
import { AsaasProviderFactory } from '../providers/asaas/asaas-provider-factory';
import { parseAsaasReaisToCents } from '../../shared/asaas-money';
import { log } from '../../shared/logger';

export type BackfillAsaasProviderNetAmountResult = {
    scanned: number;
    eligible: number;
    updated: number;
    skipped: number;
    errors: number;
};

type ChargeCandidate = Pick<
    SchoolFinancialChargeOrm,
    'id' | 'schoolId' | 'asaasPaymentId' | 'providerNetAmountCents' | 'status'
>;

export function isMissingProviderNetAmountCents(value: number | null): boolean {
    // Regra: só sai de NULL quando o Asaas retornar netValue válido.
    return value == null;
}

export async function runBackfillAsaasProviderNetAmount(): Promise<BackfillAsaasProviderNetAmountResult> {
    if (!AppDataSource.isInitialized) {
        await AppDataSource.initialize();
        log.info('[Cron] Conexão com banco de dados estabelecida');
    }

    const limit = Math.min(Math.max(Number(process.env.CRON_ASAAS_NET_AMOUNT_LIMIT ?? 200) || 200, 1), 2000);
    const dryRun = String(process.env.CRON_ASAAS_NET_AMOUNT_DRY_RUN ?? 'false') === 'true';

    const chargesRepo = AppDataSource.getRepository(SchoolFinancialChargeOrm);
    const schoolRepo = AppDataSource.getRepository(SchoolOrm);

    const result: BackfillAsaasProviderNetAmountResult = {
        scanned: 0,
        eligible: 0,
        updated: 0,
        skipped: 0,
        errors: 0
    };

    const schoolKeyCache = new Map<string, string | null>();

    // Paginação por id para evitar skip/offset caro.
    let lastId: string | null = null;

    async function persistNetAmountIfMissing(chargeId: string, cents: number): Promise<void> {
        // Atualiza somente se ainda estiver faltando (NULL).
        await chargesRepo
            .createQueryBuilder()
            .update(SchoolFinancialChargeOrm)
            .set({ providerNetAmountCents: cents })
            .where('id = :id', { id: chargeId })
            .andWhere('status = :paid', { paid: 'PAID' })
            .andWhere('asaas_payment_id IS NOT NULL')
            .andWhere('provider_net_amount_cents IS NULL')
            .execute();
    }

    log.info('[Cron] Iniciando backfill providerNetAmountCents (Asaas)', { limit, dryRun });

    while (true) {
        const qb = chargesRepo
            .createQueryBuilder('c')
            .select(['c.id', 'c.schoolId', 'c.asaasPaymentId', 'c.providerNetAmountCents', 'c.status'])
            .where('c.status = :paid', { paid: 'PAID' })
            .andWhere('c.asaasPaymentId IS NOT NULL')
            .andWhere('c.asaasPaymentId <> :empty', { empty: '' })
            // Objetivo do backfill: só preencher quando o Asaas retornar netValue válido.
            .andWhere('c.providerNetAmountCents IS NULL')
            .orderBy('c.id', 'ASC')
            .take(limit);

        if (lastId) {
            qb.andWhere('c.id > :lastId', { lastId });
        }

        const batch = (await qb.getMany()) as ChargeCandidate[];
        if (batch.length === 0) break;

        for (const row of batch) {
            result.scanned += 1;

            if (row.status !== 'PAID') {
                result.skipped += 1;
                continue;
            }

            const asaasPaymentId = row.asaasPaymentId?.trim() ?? '';
            if (!asaasPaymentId) {
                result.skipped += 1;
                continue;
            }

            if (!isMissingProviderNetAmountCents(row.providerNetAmountCents)) {
                result.skipped += 1;
                continue;
            }

            result.eligible += 1;

            let accountApiKey: string | null | undefined = schoolKeyCache.get(row.schoolId);
            if (accountApiKey === undefined) {
                const school = await schoolRepo.findOne({
                    where: { id: row.schoolId, deletedAt: IsNull() },
                    select: ['id', 'accountApiKey']
                });
                accountApiKey = school?.accountApiKey ?? null;
                schoolKeyCache.set(row.schoolId, accountApiKey);
            }

            if (!accountApiKey?.trim()) {
                log.warn('[Cron] Escola sem accountApiKey — não é possível consultar Asaas para netValue', {
                    chargeId: row.id,
                    schoolId: row.schoolId
                });
                result.skipped += 1;
                continue;
            }

            const provider = AsaasProviderFactory.createSubAccountProvider(accountApiKey);
            if (!provider?.getPayment) {
                log.warn('[Cron] Provider Asaas não disponível (getPayment ausente)', {
                    chargeId: row.id,
                    schoolId: row.schoolId
                });
                result.skipped += 1;
                continue;
            }

            try {
                const remote = await provider.getPayment(asaasPaymentId);
                const cents = parseAsaasReaisToCents(remote.netValue);
                const resolved = cents != null && cents > 0 ? cents : null;
                if (resolved == null) {
                    result.skipped += 1;
                    continue;
                }

                if (dryRun) {
                    result.updated += 1;
                    continue;
                }

                await persistNetAmountIfMissing(row.id, resolved);
                result.updated += 1;
            } catch (error) {
                result.errors += 1;
                log.warn('[Cron] Falha ao buscar netValue no Asaas', {
                    chargeId: row.id,
                    schoolId: row.schoolId,
                    asaasPaymentId,
                    error: error instanceof Error ? error.message : String(error)
                });
                // Não altera o banco aqui: permanece NULL para tentar novamente no próximo ciclo.
            }
        }

        lastId = batch[batch.length - 1]?.id ?? lastId;
    }

    log.info('[Cron] Backfill providerNetAmountCents concluído', result);
    return result;
}

async function main() {
    try {
        await runBackfillAsaasProviderNetAmount();
        process.exit(0);
    } catch (error) {
        log.error('[Cron] Erro fatal no backfill providerNetAmountCents', {
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined
        });
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}

