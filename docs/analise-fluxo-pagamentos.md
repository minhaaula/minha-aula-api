# Análise do processamento de pagamentos

Este documento descreve os fluxos de pagamento da API para suportar um refactor da lógica. Inclui entradas (webhook, jobs, use cases), estados das entidades e pontos de atenção.

---

## 1. Visão geral: dois fluxos de “pagamento”

| Fluxo | Entidade principal | Provider | Gatilho | Uso |
|-------|--------------------|----------|---------|-----|
| **Assinaturas (planos escolares)** | `SchoolPlanInvoice` + `SchoolPlanFinance` | Asaas (boleto/PIX) | Webhook + jobs | Cobrança recorrente de planos por escola |
| **Pagamentos avulsos** | `Payment` (domain) | PaymentProviderPort (authorize/capture) | API REST | CreatePayment → CapturePayment (não usa webhook Asaas) |

O refactor que impacta “processamento de pagamentos” tende a focar no **fluxo de assinaturas** (webhook + sync + recibos). O módulo `Payments` (CreatePayment/CapturePayment) é independente e não é tratado em detalhe abaixo.

---

## 2. Fluxo de assinaturas (School Plan Invoices)

### 2.1 Modelo de dados resumido

- **SchoolPlanInvoice**: uma cobrança (boleto ou PIX) ligada a um plano. Status: `ISSUED` | `PAID` | `FAILED` | `CANCELLED`. Tem `providerRef` (ID no Asaas), `externalReference`, `receiptUrl`, `paidAt`, `metadata` (idempotência, subconta, etc.).
- **SchoolPlanFinance**: assinatura da escola ao plano. Status: `TRIAL` | `ACTIVE` | `PAST_DUE` | `SUSPENDED` | `CANCELLED`. Tem `isPaid`, `lastPaymentAt`, `nextDueAt`.

Relação: várias invoices por finance; quando uma invoice é paga/cancelada/vencida, o use case atualiza a invoice e o finance.

### 2.2 Onde a cobrança é criada

| Use case | Arquivo | O que faz |
|----------|---------|-----------|
| `IssueSchoolPlanInvoice` | `app/use-cases/issue-school-plan-invoice.ts` | Busca escola, finance ativo, plano; opcionalmente cupom; cria boleto ou PIX no Asaas (`createBoletoCharge` / `createPixCharge`); persiste uma ou várias `SchoolPlanInvoice` (status `ISSUED`); atualiza `nextDueAt` do finance. |

Chamado a partir de rotas de escolas (ex.: escolher plano, gerar cobrança mensal). O provider usado é o **PaymentProviderPort** (implementado pelo Asaas), que devolve `providerRef` e links (boleto/PIX).

### 2.3 Onde o pagamento é “processado” (baixa no sistema)

O processamento (reconhecer que o cliente pagou, cancelou ou venceu) ocorre em **um único use case**: **HandleAsaasPaymentWebhook**.

| Entrada | Arquivo | Descrição |
|--------|---------|-----------|
| **Webhook HTTP** | `infra/http/routes/webhooks/asaas.routes.ts` | `POST /webhooks/asaas/payments` → valida token, normaliza body (Zod), chama `handleAsaasPaymentWebhook.exec({ event, payment, eventId })`. |
| **Sync job** | `app/use-cases/sync-payment-status.ts` | Job BullMQ a cada 15 min. Busca invoices `ISSUED` com `providerRef` (últimos 7 dias); para cada uma consulta `asaasProvider.getPayment(providerRef)`; se status no Asaas for pago/vencido/cancelado e a invoice ainda estiver `ISSUED`, **reutiliza** `HandleAsaasPaymentWebhook.exec()` passando um payload simulado (evento + payment). |

Ou seja: tanto o webhook em tempo real quanto o sync em background delegam toda a regra para **HandleAsaasPaymentWebhook**.

---

## 3. HandleAsaasPaymentWebhook (núcleo do processamento)

Arquivo: `app/use-cases/handle-asaas-payment-webhook.ts`.

### 3.1 Fluxo em etapas

1. **Entrada**: `event` (ex.: `PAYMENT_RECEIVED`, `PAYMENT_OVERDUE`), `payment` (id, status, externalReference, datas, metadata), `eventId` (idempotência).
2. **Resolução do invoice**:  
   - Busca por `payment.id` (providerRef) em `invoices.findByProviderRef`.  
   - Fallback: `payment.externalReference` em `invoices.findByExternalReference`.  
   - Se não achar invoice → `{ handled: false, reason: 'Invoice not found' }`.
3. **Validação de escola**: se `payment.metadata.schoolId` existir, deve bater com `invoice.schoolId`; senão rejeita (evitar baixa na escola errada).
4. **Outcome**: `resolveOutcome(eventName, status)` mapeia evento/status Asaas para estado interno:
   - **Sucesso** (RECEIVED, CONFIRMED, etc.) → invoice `PAID`, finance `ACTIVE`.
   - **Cancelado** (CANCELLED, REFUNDED, etc.) → invoice `CANCELLED`, finance `SUSPENDED`.
   - **Vencido** (OVERDUE) → invoice `FAILED`, finance `PAST_DUE`.
   - **Pendente** (PENDING, PAYMENT_CREATED) → invoice `ISSUED`, finance `ACTIVE` (sem mudança efetiva).
5. **Idempotência** (várias camadas):
   - Se `eventId` já está em `invoice.metadata.processedEventIds` → retorna sem alterar.
   - Se `lastProcessedProviderRef` + `lastProcessedStatus` já correspondem ao outcome atual → retorna.
   - Se invoice já está no `outcome.status` e último evento/status é o mesmo → retorna.
6. **Atualização da invoice**: `paidAt` (para PAID), `metadata` (eventId, lastProcessed*, lastWebhookEvent, etc.). Se outcome é PAID → chama **ensureSchoolSubAccount** (ver abaixo). Depois `invoices.save(updatedInvoice)`.
7. **Atualização do finance**: busca finance por `invoice.financeId`; se já está no estado desejado, não altera; senão atualiza status, `isPaid`, `lastPaymentAt` e `finances.save(updatedFinance)`.
8. **Retorno**: `{ handled: true }` ou, nos early returns, `{ handled, reason }`.

### 3.2 ensureSchoolSubAccount (subconta Asaas)

Quando o outcome é **PAID**, o use case garante que a escola tenha subconta no Asaas:

- Se a escola já tem `accountId` → só preenche metadata (accountId, status, companyType, incomeValue, accountLinkedAt).
- Se não tem `accountId` mas o webhook trouxe em `metadata` (accountId, status, etc.) → salva na escola e metadata.
- Caso contrário → chama `asaasProvider.createSubAccount(...)` com dados da escola (nome, email, CNPJ, endereço, etc.); salva `accountId`, opcionalmente `accountApiKey` e `walletId` na escola; preenche metadata.  
  Em background (não bloqueia resposta): `fetchAndSaveOnboardingUrl(schoolId, apiKey)` após 15s para buscar link de onboarding e persistir na escola.

Validações: nome, email, documento (CNPJ da escola **ou**, na ausência de CNPJ, CPF do titular), telefone, endereço; `incomeValue` e `companyType` com defaults (PF → `INDIVIDUAL`). Para PF, a escola deve ter **`ownerBirthDate`** persistido: sem ela o worker não chama `createSubAccount`; com ela o payload inclui `birthDate` (YYYY-MM-DD) no Asaas.

### 3.3 Refactor aplicado: subconta em fila

- **Implementado**: A criação/vinculação da subconta Asaas foi removida do webhook e passou para uma fila. Quando o outcome é PAID, o `HandleAsaasPaymentWebhook` enfileira o job `ensure_school_asaas_account` (payload: `{ invoiceId }`) em vez de chamar `ensureSchoolSubAccount` de forma síncrona. O worker processa o job com o use case `EnsureSchoolAsaasAccount`; se uma nova subconta for criada e tiver `apiKey`, o worker aguarda 15s e chama `getOnboardingUrl` (porta Asaas), persistindo a URL na escola. O webhook responde rápido ao Asaas e a lógica pesada roda em background.
- **Duplicação de lógica de subconta**: **FetchPaymentReceipts** ainda cria subconta na “primeira parcela” quando a escola não tem `accountId`. Pode ser unificado no futuro para usar o mesmo use case ou enfileirar o mesmo job.

---

## 4. Sync de status (SyncPaymentStatus)

- **Agendamento**: Job BullMQ `sync_payment_status` a cada **15 minutos** (e uma execução imediata no startup). Definido em `job-scheduler.ts`; `scheduleAllJobs()` é chamado no **admin-module** ao subir a aplicação.
- **Worker**: `worker-manager.ts` trata o job `sync_payment_status`: monta adapters (invoices, finances, schools, AsaasProvider) e chama `SyncPaymentStatus.exec({ limit: 50, daysAgo: 7 })`.
- **Lógica**:  
  - `invoices.findIssuedWithProviderRef(limit, daysAgo)` → lista invoices emitidas recentemente com providerRef.  
  - Para cada uma: `asaasProvider.getPayment(providerRef)`.  
  - Se status no Asaas é “pago” e invoice está ISSUED → `webhookHandler.exec({ event: 'PAYMENT_RECEIVED', payment: { ... } })`.  
  - Se status é “vencido” e invoice ISSUED → `webhookHandler.exec({ event: 'PAYMENT_OVERDUE', ... })`.  
  - Se status é “cancelado” e invoice ISSUED → `webhookHandler.exec({ event: 'PAYMENT_CANCELED', ... })`.  
  - Contadores: processed, updated, errors, skipped.

Ou seja: o sync não duplica a regra; apenas **reutiliza** o mesmo use case do webhook com payload simulado. Isso é positivo para consistência; no refactor basta manter essa delegação e, se necessário, extrair um “ApplyPaymentOutcome” que tanto o webhook quanto o sync chamem.

---

## 5. Recibos (FetchPaymentReceipts)

- **Agendamento**: Job BullMQ `fetch_payment_receipts` a cada **30 minutos** (+ execução imediata no startup), no mesmo `scheduleAllJobs()`.
- **Worker**: monta adapters e chama `FetchPaymentReceipts.exec({ limit: 50 })`.
- **Lógica**:  
  - `invoices.findPaidWithoutReceiptUrl(limit)` → invoices com status PAID, sem `receiptUrl`, com `providerRef`.  
  - Para cada uma: `asaasProvider.getPayment(providerRef)`; se existir `transactionReceiptUrl`, atualiza a invoice com `receiptUrl` e persiste.  
  - **Se for a primeira invoice do finance** (ordenando por dueDate) **e a escola não tem accountId**: tenta criar subconta Asaas (createSubAccount) e salvar na escola. Aqui está a **duplicação** com `ensureSchoolSubAccount` do webhook (critérios e fluxo semelhantes, implementação própria).

Pontos para refactor: unificar criação/vinculação de subconta com o fluxo do webhook; usar `log` em vez de `console.error`; considerar extrair “primeira parcela + sem conta” para um único lugar (ex.: após marcar invoice como PAID no webhook já garantir subconta, e no FetchPaymentReceipts só preencher recibo).

---

## 6. Bootstrap e dependências

- **Webhook**: O router Asaas (`asaasWebhookRouter`) recebe `handleAsaasPaymentWebhook` e `handleAsaasAccountWebhook`. Esses use cases são criados no **schools-module** (que tem os repositórios de invoice, finance, school e o provider Asaas) e o router de webhook é montado no mesmo módulo (ou onde o app monta rotas de webhook).
- **SyncPaymentStatus**: no worker é instanciado com **novos** adapters (import dinâmico no worker). Dentro do use case, **SyncPaymentStatus** instancia **HandleAsaasPaymentWebhook** por dentro (não recebe via construtor). Para um refactor mais limpo, o handler poderia ser injetado no SyncPaymentStatus.
- **FetchPaymentReceipts**: mesmo padrão do worker (adapters criados no worker); enfileira `ensure_school_asaas_account` quando primeira parcela e escola sem conta (mesmo fluxo do webhook).

---

## 7. Resumo dos fluxos aplicados

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ EMISSÃO DE COBRANÇA                                                          │
│ IssueSchoolPlanInvoice → PaymentProviderPort (Asaas) createBoleto/Pix       │
│ → SchoolPlanInvoice (ISSUED) + providerRef salvo                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ PROCESSAMENTO (baixa no sistema)                                             │
│                                                                              │
│  ┌──────────────────────┐     ┌─────────────────────────────────────────┐   │
│  │ POST /webhooks/asaas │     │ Job: sync_payment_status (a cada 15 min) │   │
│  │ /payments            │     │ findIssuedWithProviderRef → getPayment   │   │
│  │ (event + payment)    │     │ → se pago/vencido/cancelado, simula       │   │
│  └──────────┬───────────┘     │ evento e chama mesmo handler abaixo     │   │
│             │                  └────────────────────┬────────────────────┘   │
│             │                                       │                         │
│             └───────────────────┬───────────────────┘                         │
│                                 ▼                                             │
│             HandleAsaasPaymentWebhook.exec(...)                               │
│               • resolveOutcome(event, status) → PAID | FAILED | CANCELLED      │
│               • idempotência (eventId, lastProcessed*, status já igual)       │
│               • invoice.withChanges(...) + save                                │
│               • se PAID → outbox.enqueue('ensure_school_asaas_account', …)     │
│               • finance.withChanges(...) + save                                │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                      ┌───────────────┴───────────────┐
                      ▼ (job ensure_school_asaas_account)
┌─────────────────────────────────────────────────────────────────────────────┐
│ WORKER: EnsureSchoolAsaasAccount                                              │
│ Carrega invoice por invoiceId; se PAID, garante subconta Asaas na escola,     │
│ atualiza metadata da invoice; se subconta criada com apiKey → aguarda 15s     │
│ e busca/salva onboarding URL na escola (getOnboardingUrl na porta Asaas).    │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ RECIBOS                                                                      │
│ Job: fetch_payment_receipts (a cada 30 min)                                 │
│ findPaidWithoutReceiptUrl → getPayment → receiptUrl na invoice               │
│ + (primeira parcela + escola sem conta) → createSubAccount duplicado         │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 8. Sugestões para o refactor

1. **Extrair “aplicar outcome”**: um use case ou função interna que receba (invoice, finance, outcome) e só faça as atualizações de invoice + finance. O HandleAsaasPaymentWebhook ficaria: resolver invoice, validar escola, idempotência, resolveOutcome, chamar “aplicar outcome”, e só então ensureSchoolSubAccount se PAID.
2. **Unificar criação de subconta**: um único lugar (ex.: use case ou serviço “EnsureSchoolAsaasAccount”) chamado por HandleAsaasPaymentWebhook (quando PAID) e, se fizer sentido, por FetchPaymentReceipts quando for primeira parcela e escola sem conta (ou remover essa lógica do FetchPaymentReceipts e confiar no webhook/sync para ter criado a subconta).
3. **Injetar HandleAsaasPaymentWebhook no SyncPaymentStatus**: em vez de instanciar o handler dentro do sync, recebê-lo no construtor (e no worker passar a instância ou as deps do módulo que já criam o handler).
4. **Mover onboarding URL para a porta Asaas**: `fetchAndSaveOnboardingUrl` usar `AsaasProviderPort.getOnboardingUrl(accountApiKey)` (implementação na infra com axios e env), mantendo a app sem dependência de HTTP/axios.
5. **Padronizar logs e erros**: substituir `console.warn`/`console.error` por `log`; em erros de negócio usar `AppError` onde couber (já documentado em `errors.README.md`).
6. **Documentar mapeamento evento/status → outcome**: manter uma tabela ou constante (ex.: em `handle-asaas-payment-webhook.ts` ou em um tipo compartilhado) com todos os eventos e status do Asaas que geram PAID, FAILED, CANCELLED, ISSUED, para facilitar manutenção e testes.

Com isso você tem uma visão clara dos fluxos e dos pontos onde concentrar o refactor da lógica de processamento de pagamentos.
