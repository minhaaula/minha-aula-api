---
sidebar_position: 3
title: Módulo Payments
---

# Módulo Payments

Criação e captura de **pagamentos** via provedor (integração Asaas no projeto), com fila assíncrona para efeitos colaterais quando necessário.

## Funcionalidades

- Criar intenção / cobrança e **capturar** pagamento conforme o fluxo exposto nas rotas.
- Integração com o modelo de domínio de pagamentos e webhooks pode complementar o ciclo de vida (dependendo da montagem dos módulos).

## OpenAPI

Arquivo: `docs/payments.yaml`.

## Dependências

- `ASAAS_API_KEY` (e configurações do provedor) quando o módulo payments ou schools está ativo em conjunto com o fluxo financeiro.

## Cada rota (detalhe)

[Payments — rotas e funcionalidades](/modules/routes/payments)
