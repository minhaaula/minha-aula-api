# Configuração de Webhooks do Asaas (produção)

Este documento descreve como configurar e operar os webhooks do Asaas para a integração white-label da Minha Aula.

> Resumo executivo:
> - Em produção, todo webhook é autenticado por `authToken` (header `asaas-access-token`).
> - O servidor expõe três endpoints: `/payments`, `/accounts`, `/transfers`.
> - O endpoint aceita **dois** tokens (master e subconta), permitindo rotação independente.
> - O parser é tolerante a erros (retorna 200 com `handled:false`) para não pausar a fila do Asaas.

## 1. Endpoints expostos pela API

Todos sob o prefixo `POST /integrations/asaas/...`:

| Endpoint                              | Origem dos eventos                                 | Use-case responsável                |
| ------------------------------------- | -------------------------------------------------- | ----------------------------------- |
| `POST /integrations/asaas/payments`   | Conta master (planos da escola) **e** subcontas    | `HandleAsaasPaymentWebhook`         |
| `POST /integrations/asaas/accounts`   | Status do KYC (conta master e subcontas)           | `HandleAsaasAccountWebhook`         |
| `POST /integrations/asaas/transfers`  | Saques iniciados pelas escolas                     | `HandleAsaasTransferWebhook`        |

Todos respondem `200 OK` com `{ ok, handled, reason }`. Em caso de payload inválido ou parsing falho, ainda retornamos `200 { ok: true, handled: false, reason: "parse_error" }` para não pausar a fila do Asaas — o erro fica registrado em log.

## 2. Autenticação

O Asaas envia o `authToken` cadastrado em **cada webhook** no header `asaas-access-token`. O servidor aceita os dois tokens abaixo simultaneamente:

- `ASAAS_WEBHOOK_TOKEN` — para webhooks cadastrados na conta master.
- `ASAAS_SUBACCOUNT_WEBHOOK_AUTH_TOKEN` — para webhooks que criamos automaticamente nas subcontas (`POST /v3/accounts` com `webhooks[]`).

> Em produção é obrigatório ter pelo menos um dos dois configurado quando o módulo `schools` está ativo. Os tokens devem ser **diferentes** de `AUTH_TOKEN_SECRET` (o servidor recusa subir caso sejam iguais).

### Requisitos de segurança do `authToken` (Asaas)

- Entre 32 e 255 caracteres
- Sem espaços em branco
- Sem sequências numéricas (ex.: `12345`) ou 4 letras repetidas
- Não pode ser uma chave de API Asaas

## 3. Cadastro do webhook na conta master Asaas

Os webhooks da conta master cobrem o ciclo de cobrança do plano da escola. Eles **não** são criados automaticamente pelo código — precisam ser cadastrados via painel ou via API (`POST /v3/webhooks`) com a chave da conta master.

Sugestão de cadastro (3 webhooks na conta master, todos com `authToken = ASAAS_WEBHOOK_TOKEN`):

### 3.1. Pagamentos da conta master

- **URL**: `https://<API_PROD_URL>/integrations/asaas/payments`
- **Versão da API**: `3`
- **Tipo de envio**: `SEQUENTIALLY`
- **Eventos**:
  - `PAYMENT_CREATED`
  - `PAYMENT_UPDATED`
  - `PAYMENT_CONFIRMED`
  - `PAYMENT_RECEIVED`
  - `PAYMENT_OVERDUE`
  - `PAYMENT_DELETED`
  - `PAYMENT_REFUNDED`
  - `PAYMENT_REFUND_IN_PROGRESS`
  - `PAYMENT_CHARGEBACK_REQUESTED`
  - `PAYMENT_CHARGEBACK_DISPUTE`
  - `PAYMENT_AWAITING_CHARGEBACK_REVERSAL`
  - `PAYMENT_RECEIVED_IN_CASH_UNDONE`
  - `PAYMENT_BANK_SLIP_CANCELLED`

### 3.2. Status de conta (KYC) na conta master

- **URL**: `https://<API_PROD_URL>/integrations/asaas/accounts`
- **Eventos**:
  - `ACCOUNT_STATUS_GENERAL_APPROVAL_APPROVED`
  - `ACCOUNT_STATUS_GENERAL_APPROVAL_REJECTED`
  - `ACCOUNT_STATUS_GENERAL_APPROVAL_AWAITING_APPROVAL`
  - `ACCOUNT_STATUS_GENERAL_APPROVAL_PENDING`
  - `ACCOUNT_STATUS_BANK_ACCOUNT_INFO_*` (4 variações)
  - `ACCOUNT_STATUS_COMMERCIAL_INFO_*` (4 variações + `EXPIRING_SOON` + `EXPIRED`)
  - `ACCOUNT_STATUS_DOCUMENT_*` (4 variações)

### 3.3. Transferências (opcional na conta master, recomendado)

- **URL**: `https://<API_PROD_URL>/integrations/asaas/transfers`
- **Eventos**: `TRANSFER_CREATED`, `TRANSFER_PENDING`, `TRANSFER_IN_BANK_PROCESSING`, `TRANSFER_BLOCKED`, `TRANSFER_DONE`, `TRANSFER_FAILED`, `TRANSFER_CANCELLED`

## 4. Webhooks de subcontas (criação automática)

Quando uma subconta é criada (`POST /v3/accounts`), enviamos no payload o array `webhooks` com **três** webhooks: pagamentos, contas e transferências. Todos usam `authToken = ASAAS_SUBACCOUNT_WEBHOOK_AUTH_TOKEN`.

### Variáveis de ambiente

```bash
# URL base — gera /payments, /accounts e /transfers
ASAAS_SUBACCOUNT_WEBHOOK_URL=https://api.minha-escola.com/integrations/asaas
ASAAS_SUBACCOUNT_WEBHOOK_EMAIL=webhooks@minha-escola.com
ASAAS_SUBACCOUNT_WEBHOOK_SEND_TYPE=SEQUENTIALLY
ASAAS_SUBACCOUNT_WEBHOOK_API_VERSION=3
ASAAS_SUBACCOUNT_WEBHOOK_AUTH_TOKEN=<token-com-32-a-255-chars-conforme-secao-2>

# Pagamentos (default já cobre o ciclo completo, incluindo overdue/cancel/refund/chargeback)
ASAAS_SUBACCOUNT_WEBHOOK_EVENTS=PAYMENT_CREATED,PAYMENT_UPDATED,PAYMENT_CONFIRMED,PAYMENT_RECEIVED,PAYMENT_OVERDUE,PAYMENT_DELETED,PAYMENT_REFUNDED,PAYMENT_REFUND_IN_PROGRESS,PAYMENT_CHARGEBACK_REQUESTED,PAYMENT_CHARGEBACK_DISPUTE,PAYMENT_AWAITING_CHARGEBACK_REVERSAL,PAYMENT_RECEIVED_IN_CASH_UNDONE,PAYMENT_BANK_SLIP_CANCELLED

# Contas / KYC (default cobre todas as etapas)
ASAAS_SUBACCOUNT_ACCOUNT_WEBHOOK_URL=https://api.minha-escola.com/integrations/asaas
ASAAS_SUBACCOUNT_ACCOUNT_WEBHOOK_EVENTS=ACCOUNT_STATUS_GENERAL_APPROVAL_APPROVED,ACCOUNT_STATUS_GENERAL_APPROVAL_REJECTED,ACCOUNT_STATUS_GENERAL_APPROVAL_AWAITING_APPROVAL,ACCOUNT_STATUS_GENERAL_APPROVAL_PENDING,ACCOUNT_STATUS_BANK_ACCOUNT_INFO_APPROVED,ACCOUNT_STATUS_BANK_ACCOUNT_INFO_AWAITING_APPROVAL,ACCOUNT_STATUS_BANK_ACCOUNT_INFO_PENDING,ACCOUNT_STATUS_BANK_ACCOUNT_INFO_REJECTED,ACCOUNT_STATUS_COMMERCIAL_INFO_APPROVED,ACCOUNT_STATUS_COMMERCIAL_INFO_AWAITING_APPROVAL,ACCOUNT_STATUS_COMMERCIAL_INFO_PENDING,ACCOUNT_STATUS_COMMERCIAL_INFO_REJECTED,ACCOUNT_STATUS_COMMERCIAL_INFO_EXPIRING_SOON,ACCOUNT_STATUS_COMMERCIAL_INFO_EXPIRED,ACCOUNT_STATUS_DOCUMENT_APPROVED,ACCOUNT_STATUS_DOCUMENT_AWAITING_APPROVAL,ACCOUNT_STATUS_DOCUMENT_PENDING,ACCOUNT_STATUS_DOCUMENT_REJECTED

# Transferências (default cobre o ciclo de saque)
ASAAS_SUBACCOUNT_TRANSFER_WEBHOOK_URL=https://api.minha-escola.com/integrations/asaas
ASAAS_SUBACCOUNT_TRANSFER_WEBHOOK_EVENTS=TRANSFER_CREATED,TRANSFER_PENDING,TRANSFER_IN_BANK_PROCESSING,TRANSFER_BLOCKED,TRANSFER_DONE,TRANSFER_FAILED,TRANSFER_CANCELLED
```

## 5. Persistência do KYC (white-label)

`HandleAsaasAccountWebhook` agora:

- Localiza a escola por `externalReference` (preferencial) **ou** por `accountId` (`SchoolRepository.findByAccountId`).
- Persiste o objeto `accountStatus` enviado pelo Asaas em `schools.account_status_snapshot` (JSON), com chaves `commercialInfo`, `bankAccountInfo`, `documentation`, `general`, `lastEvent`, `lastEventAt`. Quando o Asaas não envia `accountStatus`, o nome do evento é usado para inferir a etapa/status.
- Marca `onboarding_completed_at` somente em `ACCOUNT_STATUS_GENERAL_APPROVAL_APPROVED`.
- Salva `accountId` / `apiKey` / `walletId` quando vierem no payload e ainda não estiverem definidos.

## 6. Fluxo de saques (`/transfers`)

1. `RequestSchoolWithdrawal` chama `POST /v3/accounts/{id}/transfers` na subconta.
2. O `id` retornado é persistido em `school_withdrawals.provider_ref` antes de qualquer transição de status.
3. Status na resposta síncrona:
   - `DONE` / `COMPLETED` → marcamos como `COMPLETED`.
   - `CANCELLED` / `FAILED` / `BLOCKED` → marcamos como `CANCELLED` com `failure_reason`.
   - `PENDING` / `IN_BANK_PROCESSING` → fica em `PROCESSING` aguardando webhook.
4. Quando o Asaas dispara `TRANSFER_DONE` / `TRANSFER_FAILED` / etc., o webhook localiza o saque pelo `provider_ref` e atualiza o status (`HandleAsaasTransferWebhook`).

## 7. Boas práticas operacionais

- **HTTPS** obrigatório em produção.
- **Idempotência**: `HandleAsaasPaymentWebhook` registra os últimos `eventId` processados em `metadata.processedEventIds`. Eventos duplicados são detectados.
- **Rate limit**: aplicado por IP no router (`webhookRateLimiter`).
- **Logs**: cada evento é logado com sanitização (`sanitizeForLogging`) para evitar vazamento de PII.
- **Fila pausada**: o Asaas guarda eventos por 14 dias. Se o servidor responder com erro 15 vezes, a fila é pausada — o parser tolerante e o retorno 200 minimizam esse risco.

## 8. Estrutura do código

- Rotas: `src/infra/http/routes/webhooks/asaas.routes.ts`
- Handlers:
  - `src/app/use-cases/handle-asaas-payment-webhook.ts`
  - `src/app/use-cases/handle-asaas-account-webhook.ts`
  - `src/app/use-cases/handle-asaas-transfer-webhook.ts`
- Provider: `src/infra/providers/asaas/asaas-provider.ts`
- Client: `src/infra/providers/asaas/asaas-client.ts`
- Migrations relacionadas: `1000000000018-add-school-account-id`, `1000000000040-add-school-account-api-key`, `1000000000042-add-school-wallet-id`, `1000000000049-add-school-onboarding-url`, `1000000000052-add-school-onboarding-completed-at`, `1000000000069-asaas-production-fields`.

## 9. Testes manuais

```bash
# Pagamento
curl -X POST https://<API_URL>/integrations/asaas/payments \
  -H "Content-Type: application/json" \
  -H "asaas-access-token: $ASAAS_WEBHOOK_TOKEN" \
  -d '{
    "id": "evt_test_001",
    "event": "PAYMENT_CONFIRMED",
    "payment": {
      "id": "pay_123456",
      "status": "RECEIVED",
      "externalReference": "finance-123:2026-05-05",
      "paymentDate": "2026-05-05"
    },
    "dateCreated": "2026-05-05 12:00:00"
  }'

# Conta (KYC)
curl -X POST https://<API_URL>/integrations/asaas/accounts \
  -H "Content-Type: application/json" \
  -H "asaas-access-token: $ASAAS_SUBACCOUNT_WEBHOOK_AUTH_TOKEN" \
  -d '{
    "id": "evt_test_002",
    "event": "ACCOUNT_STATUS_DOCUMENT_AWAITING_APPROVAL",
    "account": { "id": "acc_xyz" },
    "accountStatus": {
      "commercialInfo": "APPROVED",
      "bankAccountInfo": "APPROVED",
      "documentation": "AWAITING_APPROVAL",
      "general": "AWAITING_APPROVAL"
    }
  }'

# Transferência (saque)
curl -X POST https://<API_URL>/integrations/asaas/transfers \
  -H "Content-Type: application/json" \
  -H "asaas-access-token: $ASAAS_SUBACCOUNT_WEBHOOK_AUTH_TOKEN" \
  -d '{
    "id": "evt_test_003",
    "event": "TRANSFER_DONE",
    "transfer": {
      "id": "tr_abc123",
      "status": "DONE",
      "effectiveDate": "2026-05-05"
    }
  }'
```
