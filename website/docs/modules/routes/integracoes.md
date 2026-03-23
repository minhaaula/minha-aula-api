---
sidebar_position: 9
title: Integrações & health
---

# Integrações e transversal

Webhooks **Asaas**, **health** e **landing**.

> Referência técnica completa: [Swagger UI](pathname:///docs) · [OpenAPI JSON](pathname:///docs/openapi.json)

## Endpoints (4)

### `POST` `/integrations/asaas/accounts`

**Resumo:** Webhook de contas Asaas

**Funcionalidade:**

Recebe notificações de criação e aprovação de contas/subcontas no Asaas.
Disponível apenas quando o módulo **schools** está ativo.
Em produção, o token de autenticação (ASAAS_WEBHOOK_TOKEN) é obrigatório.
O token pode ser enviado no header `asaas-access-token`, `x-asaas-access-token` ou na query `token`.

---

### `POST` `/integrations/asaas/payments`

**Resumo:** Webhook de pagamentos Asaas

**Funcionalidade:**

Recebe notificações de pagamentos do Asaas (conta principal ou subcontas).
Disponível apenas quando o módulo **schools** está ativo.
Em produção, o token de autenticação (ASAAS_WEBHOOK_TOKEN) é obrigatório.
O token pode ser enviado no header `asaas-access-token`, `x-asaas-access-token` ou na query `token`.

---

### `GET` `/health`

**Resumo:** Verificar o estado da aplicação

**Funcionalidade:** ver detalhes e parâmetros no [Swagger](pathname:///docs) (tag correspondente).

---

### `GET` `/landing/plans`

**Resumo:** Listar planos disponíveis para escolas

**Funcionalidade:**

Rota pública para landpages que retorna todos os planos de assinatura ativos disponíveis para contratação pelas escolas. Esta rota não requer autenticação e pode ser utilizada em páginas públicas de marketing.

---

