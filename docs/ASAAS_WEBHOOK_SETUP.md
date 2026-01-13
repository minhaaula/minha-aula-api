# Configuração de Webhooks do Asaas

Este documento explica como configurar os webhooks do Asaas para receber notificações de pagamentos.

## Tipos de Webhooks

Existem dois tipos de webhooks no sistema:

1. **Webhook Principal**: Recebe notificações de pagamentos da conta principal do Asaas
2. **Webhook de Subcontas**: Configurado automaticamente quando uma subconta é criada para uma escola

## 1. Webhook Principal (Conta do Asaas)

### Endpoint da API

O endpoint do webhook está disponível em:
```
POST /integrations/asaas/payments
```

**URL completa**: `https://seu-dominio.com/integrations/asaas/payments`

### Configuração no Painel do Asaas

1. Acesse o painel do Asaas: https://www.asaas.com
2. Vá em **Configurações** > **Webhooks**
3. Clique em **Criar Webhook**
4. Configure:
   - **URL**: `https://seu-dominio.com/integrations/asaas/payments`
   - **Eventos**: Selecione os eventos que deseja receber:
     - `PAYMENT_CREATED` - Pagamento criado
     - `PAYMENT_UPDATED` - Pagamento atualizado
     - `PAYMENT_CONFIRMED` - Pagamento confirmado
     - `PAYMENT_RECEIVED` - Pagamento recebido
     - `PAYMENT_OVERDUE` - Pagamento vencido
     - `PAYMENT_DELETED` - Pagamento deletado
     - `PAYMENT_CANCELED` - Pagamento cancelado
     - `PAYMENT_REFUNDED` - Pagamento estornado
     - `PAYMENT_CHARGEBACK` - Pagamento com chargeback
   - **Token de Autenticação** (opcional): Configure um token para validação
   - **Versão da API**: 3

### Formato do Payload

O webhook recebe um payload no seguinte formato:

```json
{
  "event": "PAYMENT_CONFIRMED",
  "payment": {
    "id": "pay_123456789",
    "status": "RECEIVED",
    "externalReference": "finance-123:2024-06-05",
    "paymentDate": "2024-06-06T12:00:00Z",
    "confirmedDate": "2024-06-06T12:00:00Z",
    "receivedDate": "2024-06-06T12:00:00Z",
    "dueDate": "2024-06-05",
    "customer": {
      "id": "cus_123456789"
    },
    "value": 150.00
  }
}
```

### Eventos Suportados

O sistema processa os seguintes eventos:

**Eventos de Sucesso:**
- `PAYMENT_RECEIVED` - Marca a fatura como paga
- `PAYMENT_CONFIRMED` - Marca a fatura como paga

**Eventos de Vencimento:**
- `PAYMENT_OVERDUE` - Marca a fatura como falha e o plano como vencido

**Eventos de Cancelamento:**
- `PAYMENT_DELETED` - Marca a fatura como cancelada
- `PAYMENT_CANCELED` - Marca a fatura como cancelada
- `PAYMENT_REFUNDED` - Marca a fatura como cancelada
- `PAYMENT_CHARGEBACK` - Marca a fatura como cancelada

## 2. Webhook de Subcontas (Escolas)

### Configuração Automática

Quando uma subconta é criada para uma escola (após o primeiro pagamento confirmado), o sistema configura automaticamente dois webhooks para essa subconta:
1. **Webhook de Pagamentos**: Para receber notificações de pagamentos
2. **Webhook de Contas**: Para receber notificações sobre criação e aprovação da conta

### Variáveis de Ambiente

Configure as seguintes variáveis de ambiente para controlar os webhooks das subcontas:

```bash
# URL base do webhook (obrigatório para habilitar webhooks em subcontas)
ASAAS_SUBACCOUNT_WEBHOOK_URL=https://seu-dominio.com/integrations/asaas

# URL específica para webhook de contas (opcional, usa a URL base se não configurado)
ASAAS_SUBACCOUNT_ACCOUNT_WEBHOOK_URL=https://seu-dominio.com/integrations/asaas

# Email para notificações (opcional, usa o email da escola se não configurado)
ASAAS_SUBACCOUNT_WEBHOOK_EMAIL=notificacoes@seu-dominio.com

# Nome do webhook de pagamentos (opcional, padrão: "Webhook para cobranças")
ASAAS_SUBACCOUNT_WEBHOOK_NAME=Webhook para cobranças

# Nome do webhook de contas (opcional, padrão: "Webhook para contas")
ASAAS_SUBACCOUNT_ACCOUNT_WEBHOOK_NAME=Webhook para contas

# Tipo de envio (opcional: "SIMULTANEOUSLY" ou "SEQUENTIALLY", padrão: "SEQUENTIALLY")
ASAAS_SUBACCOUNT_WEBHOOK_SEND_TYPE=SEQUENTIALLY

# Token de autenticação (opcional)
ASAAS_SUBACCOUNT_WEBHOOK_AUTH_TOKEN=seu-token-secreto

# Eventos de pagamento a serem monitorados (opcional, separados por vírgula)
# Padrão: PAYMENT_CREATED,PAYMENT_UPDATED,PAYMENT_CONFIRMED,PAYMENT_RECEIVED
ASAAS_SUBACCOUNT_WEBHOOK_EVENTS=PAYMENT_CREATED,PAYMENT_UPDATED,PAYMENT_CONFIRMED,PAYMENT_RECEIVED,PAYMENT_OVERDUE

# Eventos de conta a serem monitorados (opcional, separados por vírgula)
# Padrão: ACCOUNT_STATUS_GENERAL_APPROVAL_APPROVED,ACCOUNT_STATUS_GENERAL_APPROVAL_REJECTED,ACCOUNT_STATUS_GENERAL_APPROVAL_AWAITING_APPROVAL,ACCOUNT_STATUS_GENERAL_APPROVAL_PENDING,ACCOUNT_CREATED
ASAAS_SUBACCOUNT_ACCOUNT_WEBHOOK_EVENTS=ACCOUNT_STATUS_GENERAL_APPROVAL_APPROVED,ACCOUNT_STATUS_GENERAL_APPROVAL_REJECTED,ACCOUNT_STATUS_GENERAL_APPROVAL_AWAITING_APPROVAL,ACCOUNT_STATUS_GENERAL_APPROVAL_PENDING,ACCOUNT_CREATED

# Versão da API (opcional, padrão: 3)
ASAAS_SUBACCOUNT_WEBHOOK_API_VERSION=3
```

### Comportamento

- Se `ASAAS_SUBACCOUNT_WEBHOOK_URL` não estiver configurado, nenhum webhook será criado para as subcontas
- Os webhooks são criados automaticamente quando a primeira fatura é paga e a subconta é criada
- O webhook de pagamentos usa o endpoint `/integrations/asaas/payments`
- O webhook de contas usa o endpoint `/integrations/asaas/accounts`

## 3. Webhook de Contas (Criação e Aprovação)

### Endpoint da API

O endpoint do webhook de contas está disponível em:
```
POST /integrations/asaas/accounts
```

**URL completa**: `https://seu-dominio.com/integrations/asaas/accounts`

### Eventos Suportados

O sistema processa os seguintes eventos de conta:

**Eventos de Aprovação:**
- `ACCOUNT_STATUS_GENERAL_APPROVAL_APPROVED` - Conta aprovada
- `ACCOUNT_CREATED` - Conta criada
- `ACCOUNT_APPROVED` - Conta aprovada (alternativo)

**Eventos de Rejeição:**
- `ACCOUNT_STATUS_GENERAL_APPROVAL_REJECTED` - Conta rejeitada
- `ACCOUNT_REJECTED` - Conta rejeitada (alternativo)

**Eventos de Análise/Pendente:**
- `ACCOUNT_STATUS_GENERAL_APPROVAL_AWAITING_APPROVAL` - Conta aguardando aprovação
- `ACCOUNT_STATUS_GENERAL_APPROVAL_PENDING` - Conta pendente
- `ACCOUNT_PENDING` - Conta pendente (alternativo)
- `ACCOUNT_AWAITING_APPROVAL` - Conta aguardando aprovação (alternativo)

### Formato do Payload

O webhook recebe um payload no seguinte formato:

```json
{
  "event": "ACCOUNT_STATUS_GENERAL_APPROVAL_APPROVED",
  "account": {
    "id": "acc_123456789",
    "status": "APPROVED",
    "externalReference": "school-123",
    "name": "Escola Exemplo",
    "email": "escola@exemplo.com",
    "cpfCnpj": "12345678000100",
    "personType": "LEGAL",
    "companyType": "LIMITED",
    "dateCreated": "2024-06-06T12:00:00Z",
    "dateUpdated": "2024-06-06T12:00:00Z"
  }
}
```

### Processamento

Quando uma conta é aprovada:
- O sistema identifica a escola pelo `externalReference` (ID da escola) ou pelo `account.id`
- O status da conta é registrado para referência futura
- A aprovação pode ser usada para notificações ou ações automáticas

### Configuração no Painel do Asaas (Conta Principal)

Para receber notificações de contas na conta principal:

1. Acesse o painel do Asaas: https://www.asaas.com
2. Vá em **Configurações** > **Webhooks**
3. Clique em **Criar Webhook**
4. Configure:
   - **URL**: `https://seu-dominio.com/integrations/asaas/accounts`
   - **Eventos**: Selecione os eventos de conta:
     - `ACCOUNT_STATUS_GENERAL_APPROVAL_APPROVED`
     - `ACCOUNT_STATUS_GENERAL_APPROVAL_REJECTED`
     - `ACCOUNT_STATUS_GENERAL_APPROVAL_AWAITING_APPROVAL`
     - `ACCOUNT_STATUS_GENERAL_APPROVAL_PENDING`
     - `ACCOUNT_CREATED`
   - **Token de Autenticação** (opcional): Configure um token para validação
   - **Versão da API**: 3

## 4. Testando o Webhook

### Usando o Script de Simulação

O projeto inclui um script para simular webhooks localmente:

```bash
# Simulação básica
npm run simulate:asaas-webhook

# Com parâmetros customizados
npm run simulate:asaas-webhook -- \
  --url http://localhost:3000/integrations/asaas/payments \
  --event PAYMENT_CONFIRMED \
  --id pay_123456 \
  --status RECEIVED \
  --externalRef finance-123:2024-06-05 \
  --paymentDate 2024-06-06T12:00:00Z \
  --value 150.00
```

### Variável de Ambiente para Testes

```bash
# URL padrão para testes locais
ASAAS_WEBHOOK_URL=http://localhost:3000/integrations/asaas/payments
```

### Exemplo de Teste Manual

```bash
curl -X POST http://localhost:3000/integrations/asaas/payments \
  -H "Content-Type: application/json" \
  -d '{
    "event": "PAYMENT_CONFIRMED",
    "payment": {
      "id": "pay_123456",
      "status": "RECEIVED",
      "externalReference": "finance-123:2024-06-05",
      "paymentDate": "2024-06-06T12:00:00Z"
    }
  }'
```

## 5. Segurança

### Recomendações

1. **Use HTTPS**: Sempre configure webhooks usando HTTPS em produção
2. **Token de Autenticação**: Configure `ASAAS_SUBACCOUNT_WEBHOOK_AUTH_TOKEN` para validar requisições
3. **Validação de IP**: Considere restringir o acesso por IP (whitelist do Asaas)
4. **Logs**: Monitore os logs para detectar tentativas de acesso não autorizadas

### Validação de Token (Futuro)

O sistema pode ser estendido para validar o token de autenticação nas requisições do webhook. Atualmente, o endpoint está acessível sem autenticação (`skipAuth: true`).

## 6. Troubleshooting

### Webhook não está sendo recebido

1. Verifique se a URL está acessível publicamente
2. Verifique os logs do servidor para erros
3. Use o script de simulação para testar localmente
4. Verifique se o evento está configurado no painel do Asaas

### Webhook retorna erro

1. Verifique o formato do payload (deve seguir o schema Zod definido)
2. Verifique se a fatura existe no sistema (usando `providerRef` ou `externalReference`)
3. Verifique os logs para mensagens de erro específicas

### Subconta não cria webhook

1. Verifique se `ASAAS_SUBACCOUNT_WEBHOOK_URL` está configurado
2. Verifique se a subconta foi criada com sucesso
3. Verifique os logs durante a criação da subconta

## 7. Estrutura do Código

### Arquivos Relacionados

- **Rota do Webhook de Pagamentos**: `src/infra/http/routes/webhooks/asaas.routes.ts` (POST /payments)
- **Rota do Webhook de Contas**: `src/infra/http/routes/webhooks/asaas.routes.ts` (POST /accounts)
- **Handler de Pagamentos**: `src/app/use-cases/handle-asaas-payment-webhook.ts`
- **Handler de Contas**: `src/app/use-cases/handle-asaas-account-webhook.ts`
- **Provider**: `src/infra/providers/asaas/asaas-provider.ts`
- **Client**: `src/infra/providers/asaas/asaas-client.ts`
- **Script de Teste**: `scripts/simulate-asaas-webhook.ts`

### Fluxo de Processamento de Pagamentos

1. Webhook recebido em `/integrations/asaas/payments`
2. Payload validado com Zod schema
3. Handler processa o evento e atualiza a fatura
4. Se o pagamento foi confirmado, cria subconta (se necessário)
5. Atualiza status do plano financeiro da escola

### Fluxo de Processamento de Contas

1. Webhook recebido em `/integrations/asaas/accounts`
2. Payload validado com Zod schema
3. Handler identifica a escola pelo `externalReference` ou `account.id`
4. Processa o evento (aprovação, rejeição, pendente)
5. Registra o status da conta para referência futura

## 8. Exemplo de Resposta

### Sucesso

```json
{
  "ok": true,
  "handled": true,
  "reason": null
}
```

### Não Processado

```json
{
  "ok": true,
  "handled": false,
  "reason": "Invoice not found"
}
```

## 9. Próximos Passos

- [ ] Implementar validação de token de autenticação
- [ ] Adicionar rate limiting
- [ ] Implementar retry automático para falhas
- [ ] Adicionar métricas e monitoramento
- [ ] Implementar webhook signature validation

