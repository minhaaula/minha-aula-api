---
sidebar_position: 7
title: Matrículas (rotas)
---

# Enrollment requests — rotas

Fluxo de **pedidos de matrícula**: listagem (escola), criação (aluno ou escola), aprovação pelo aluno, boleto de taxa e detalhe do pedido.

> Referência técnica completa: [Swagger UI](pathname:///docs) · [OpenAPI JSON](pathname:///docs/openapi.json)

## Endpoints (7)

### `POST` `/enrollment-requests/charges/\{chargeId\}/boleto`

**Resumo:** Emitir boleto da taxa de matrícula

**Funcionalidade:**

Disponibiliza o boleto associado à taxa de matrícula, gerando-o no provedor quando ainda não houver boleto disponível.

---

### `GET` `/enrollment-requests/schools`

**Resumo:** Listar solicitações de matrícula por escola

**Funcionalidade:** ver detalhes e parâmetros no [Swagger](pathname:///docs) (tag correspondente).

---

### `POST` `/enrollment-requests/schools/classes/\{classId\}/requests`

**Resumo:** Criar uma solicitação de matrícula

**Funcionalidade:**

Cria uma solicitação de matrícula para um aluno ou dependente em uma turma específica.

Esta rota atende apenas `STUDENT`:
- O backend preenche automaticamente `requestedForUserId` com o ID do usuário logado (não enviar no payload).
- Para matrícula de dependente, envie `requestedForDependentId` com o ID do dependente.
- `schoolId` é obrigatório se não existir no contexto do token.

---

### `POST` `/enrollment-requests/schools/classes/\{classId\}/responsible-requests`

**Resumo:** Criar solicitação de matrícula como responsável (ADMIN/SCHOOL)

**Funcionalidade:**

Cria uma solicitação de matrícula para um aluno ou dependente como `ADMIN` ou `SCHOOL`.

- `requestedForUserId` é obrigatório e deve ser o ID do responsável (pai/mãe).
- Para matrícula de dependente, envie `requestedForDependentId`.
- Para `SCHOOL`, `schoolId` é inferido do token. Para `ADMIN`, `schoolId` deve ser enviado no body.

**Notificações ao aluno (responsável):** após criar o pedido, o sistema enfileira email de aviso, envia push (FCM, se configurado) e grava notificação in-app (`GET /students/notifications`, `metadata.kind` = `ENROLLMENT_REQUEST_RECEIVED`).

---

### `GET` `/enrollment-requests/schools/\{schoolId\}/classes/\{classId\}/requests`

**Resumo:** Listar solicitações de matrícula de uma turma

**Funcionalidade:** ver detalhes e parâmetros no [Swagger](pathname:///docs) (tag correspondente).

---

### `GET` `/enrollment-requests/\{requestId\}`

**Resumo:** Obter detalhes de uma solicitação de matrícula

**Funcionalidade:** ver detalhes e parâmetros no [Swagger](pathname:///docs) (tag correspondente).

---

### `POST` `/enrollment-requests/\{requestId\}/approve`

**Resumo:** Aprovar uma solicitação de matrícula

**Funcionalidade:**

Aprova a solicitação pelo aluno/responsável (`requestedForUserId`), cria a matrícula e gera cobranças (taxa de matrícula e primeira mensalidade) quando aplicável, incluindo geração de boleto/PIX quando o serviço estiver configurado.

**Notificações ao aluno:** enfileira email de confirmação de matrícula e grava notificação in-app (`metadata.kind` = `ENROLLMENT_CONFIRMED`). Push não é enviado neste passo.

---

