---
sidebar_position: 2
title: Módulo Admin
---

# Módulo Admin

Painel administrativo da plataforma: escolas, planos, categorias, visão financeira e ferramentas de suporte.

## Funcionalidades (visão geral)

- Autenticação dedicada (**login admin**).
- Listagem e detalhes de **escolas**, **planos de assinatura**, **categorias**.
- **Dashboard** e indicadores agregados.
- Operações sobre **faturas de plano**, **cobranças** e marcação manual quando aplicável.
- **Webhooks / jobs** — parte da fila (BullMQ) pode rodar no mesmo processo quando o worker está ativo (emails, lembretes de vencimento, etc.).

## Lembretes de cobrança

Jobs agendados podem disparar emails de vencimento e, para **mensalidades** de alunos, também **notificação in-app** e **push** (FCM), conforme configuração.

## OpenAPI

Arquivo: `docs/admin.yaml`.

## Acesso

Requer persona **ADMIN** e token válido nas rotas `/admin/...`.

## Cada rota (detalhe)

[Admin — rotas e funcionalidades](/modules/routes/admin)
