---
sidebar_position: 5
title: Módulo Students
---

# Módulo Students

App do **aluno / responsável**: perfil, dependentes, cursos, pagamentos, pedidos de matrícula, avaliações de escola e **notificações**.

## Funcionalidades principais

- **Perfil e dependentes** — CRUD de dependentes vinculados ao responsável.
- **Cursos e pagamentos** — listagem de matrículas, cobranças, geração de PIX quando disponível.
- **Pedidos de matrícula** — listar solicitações; **aceitar** ou **rejeitar** pedido criado pela escola (aprovação cria matrícula e cobranças conforme regras).
- **Notificações in-app** — `GET /students/notifications` — itens com `scope` USER para o “sino”; `metadata.kind` indica o tipo (boas-vindas, pedido de matrícula, confirmação, recusa, lembrete de mensalidade, etc.).
- **Push (FCM)** — `POST /students/push-tokens` registra o token do dispositivo para alertas (matrícula, mensalidade, etc.).

## OpenAPI

Arquivos: `docs/students.yaml`, `docs/dependents.yaml`, `docs/enrollment-requests.yaml`, `docs/schools-public.yaml`.

## Persona

Requer **`STUDENT`** nas rotas do namespace `/students/...`.

## Cada rota (detalhe)

[Students — rotas e funcionalidades](/modules/routes/students)

[Dependentes](/modules/routes/dependents) · [Pedidos de matrícula](/modules/routes/enrollment-requests)
