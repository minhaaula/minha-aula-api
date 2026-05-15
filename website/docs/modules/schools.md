---
sidebar_position: 4
title: Módulo Schools
---

# Módulo Schools

Gestão da **escola**: cadastro, cursos, turmas, alunos, financeiro (cobranças, boletos, PIX), plano da plataforma, integração **Asaas** (subconta, KYC, webhooks) e conteúdo institucional. Cadastro **sem CNPJ** (PF) exige **data de nascimento do titular** (`ownerBirthDate`) para a subconta Asaas.

## Funcionalidades principais

- **Escola** — perfil, imagens, bancos, saques, cupons quando aplicável.
- **Cursos e turmas** — CRUD, preços, categorias.
- **Matrícula direta** — `POST` em enrollments matricula aluno ou dependente na turma; dispara email de confirmação e notificação in-app ao aluno.
- **Progresso da matrícula** — níveis por escola, promoções, certificados e timeline por matrícula (módulo opcional; ver rotas `/schools/student-levels`, `/schools/certificate-templates` e `/schools/enrollments/{enrollmentId}/…`). Modelo: `docs/modelo-niveis-certificados-timeline-matricula.md`.
- **Solicitações de matrícula** — a escola pode abrir pedido para o aluno (`responsible-requests`); o aluno recebe email, push e notificação no app.
- **Financeiro** — cobranças de mensalidade e taxas, PIX/boleto conforme Asaas.
- **Webhooks Asaas** — rotas em `/integrations/asaas` (token configurável).

## Notificações (escola → turma)

A escola pode enviar notificações por turma (push + registro) quando a funcionalidade estiver habilitada — ver rotas de notificações da escola na referência OpenAPI.

## OpenAPI

Arquivos: `docs/schools.yaml`, trechos em `docs/students.yaml` e `docs/webhooks.yaml` conforme o catálogo montado.

## Persona

Requer **`SCHOOL`** (contexto da escola no token) ou **ADMIN** onde aplicável.

## Cada rota (detalhe)

[Schools — rotas e funcionalidades](/modules/routes/schools)

[API pública / cadastro de escola](/modules/routes/publico-e-cadastro) (trecho `schools-public.yaml`).
