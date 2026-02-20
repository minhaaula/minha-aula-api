# Testar fluxo Asaas local (conta + onboarding)

Como rodar a API e o worker localmente e simular o webhook de pagamento para ver o job de criação de conta Asaas e o onboarding.

## Pré-requisitos

- **Redis** rodando (o worker usa a fila BullMQ em Redis).
- **MySQL** com as migrações aplicadas.
- **Variáveis de ambiente**: `ASAAS_API_KEY`, `ASAAS_BASE_URL` (e opcionalmente `ASAAS_WEBHOOK_TOKEN` para o webhook).

## 1. Subir a API

Em um terminal:

```bash
npm run dev
```

Ou, se quiser só os módulos necessários (auth + schools + admin para listar):

```bash
APP_MODULES=all npm run dev
```

A API deve estar em **http://localhost:3000** (ou na porta configurada em `PORT`).

## 2. Subir o worker (em outro terminal)

O worker processa a fila `outbox` (incluindo o job `ensure_school_asaas_account`):

```bash
npm run worker
```

Você deve ver algo como:

```
[Worker] Worker iniciado. Pressione Ctrl+C para parar.
```

Se Redis não estiver configurado (`REDIS_HOST`), o worker pode falhar ou não processar jobs — confira as variáveis de ambiente.

## 3. Ter uma invoice com status ISSUED

O webhook identifica a invoice pelo **ID do pagamento no Asaas** (`payment.id`), que na nossa API fica salvo como `provider_ref` na invoice (ex.: ID retornado ao gerar o PIX).

- **Opção A:** Criar uma escola, associar um plano (isso gera a primeira invoice com PIX) e anotar o `providerRef` da resposta (ou o campo equivalente na listagem de faturas da escola).
- **Opção B:** Consultar no banco a invoice que você quer simular como paga:

```sql
SELECT id, school_id, finance_id, due_date, status, provider_ref, external_reference
FROM school_plan_invoices
WHERE status = 'ISSUED'
ORDER BY created_at DESC
LIMIT 5;
```

Anote o **provider_ref** da invoice que deseja “pagar” (se estiver vazio, a API também tenta localizar por `external_reference`).

## 4. Simular o webhook de pagamento confirmado

Use o **provider_ref** (id do pagamento) como `--id`:

```bash
npm run simulate:asaas-webhook -- --id SEU_PROVIDER_REF_AQUI
```

Exemplo com provider_ref real:

```bash
npm run simulate:asaas-webhook -- --id pay_abc123xyz
```

Se a API estiver em outra URL:

```bash
npm run simulate:asaas-webhook -- --url http://localhost:3000/integrations/asaas/payments --id pay_abc123xyz
```

Se você configurou `ASAAS_WEBHOOK_TOKEN`, o script envia o token no header automaticamente (desde que a variável esteja no `.env`).

**Resposta esperada:** `200` e corpo com `handled: true`. A API marca a invoice como PAID e **enfileira o job** `ensure_school_asaas_account` com o `invoiceId`.

## 5. Ver o job rodar e a conta/onboarding

No **terminal do worker** você deve ver logs na ordem:

1. `[OUTBOX] ensure_school_asaas_account: job recebido` (com `invoiceId`, `aggregateId`).
2. `[EnsureSchoolAsaasAccount] Início` → … → `Subconta criada/vinculada, salvando na escola` (ou mensagens de “Encerrado” se algo falhar).
3. Se houver `onboardingPending`: `aguardando 15s antes de buscar onboarding URL` → `getOnboardingUrl retornou` → `onboarding URL salva na escola`.
4. `[OUTBOX] ensure_school_asaas_account completed`.

No **terminal da API**, ao receber o webhook, deve aparecer algo como:

- `[Webhook Asaas] Enfileirando job ensure_school_asaas_account (conta Asaas + onboarding)` com `invoiceId`, `schoolId`, `providerRef`.

Para conferir no banco se a escola ganhou conta e onboarding:

```sql
SELECT id, name, account_id, account_api_key IS NOT NULL AS tem_api_key, wallet_id, onboarding_url
FROM schools
WHERE id = 'ID_DA_ESCOLA_DA_INVOICE';
```

Substitua `ID_DA_ESCOLA_DA_INVOICE` pelo `school_id` da invoice que você “pagou”.

## 6. Exemplo de payload manual (curl)

Se quiser chamar o webhook sem o script:

```bash
curl -X POST http://localhost:3000/integrations/asaas/payments \
  -H "Content-Type: application/json" \
  -d '{
    "event": "PAYMENT_CONFIRMED",
    "payment": {
      "id": "SEU_PROVIDER_REF_AQUI",
      "status": "RECEIVED",
      "paymentDate": "2024-06-01T14:00:00.000Z",
      "confirmedDate": "2024-06-01T14:00:00.000Z",
      "receivedDate": "2024-06-01T14:00:00.000Z"
    }
  }'
```

Se usar token:

```bash
curl -X POST http://localhost:3000/integrations/asaas/payments \
  -H "Content-Type: application/json" \
  -H "asaas-access-token: SEU_ASAAS_WEBHOOK_TOKEN" \
  -d '...'
```

O **id** dentro de `payment` deve ser exatamente o `provider_ref` de uma invoice **ISSUED** existente; caso contrário a API responde 200 mas com `handled: false` (invoice não encontrada).

## Resumo rápido

| Passo | Comando / Ação |
|-------|-----------------|
| 1 | `npm run dev` (API) |
| 2 | `npm run worker` (outro terminal) |
| 3 | Ter uma invoice ISSUED e anotar o `provider_ref` |
| 4 | `npm run simulate:asaas-webhook -- --id <provider_ref>` |
| 5 | Acompanhar logs do worker e conferir `schools.account_id` / `onboarding_url` no banco |
