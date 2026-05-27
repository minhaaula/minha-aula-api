---
sidebar_position: 1
title: Auth (rotas)
---

# Auth — rotas

Autenticação de **usuários** (não escola). Personas incluem STUDENT, ADMIN, OPERATION. Escolas usam `/schools/login`.

> Referência técnica completa: [Swagger UI](pathname:///docs) · [OpenAPI JSON](pathname:///docs/openapi.json)

## Endpoints (8)

### `POST` `/auth/login`

**Resumo:** Autenticar usuário e gerar tokens de acesso

**Funcionalidade:**

Autentica um usuário e retorna um access token (validade curta) e um refresh token (validade de 30 dias).
O refresh token deve ser usado para obter novos access tokens quando o atual expirar.

**App do aluno (opcional):** no body, envie os quatro campos juntos para persistir metadados do dispositivo:

| Campo | Tipo | Exemplo |
|-------|------|---------|
| `platform` | `ANDROID` \| `IOS` | `ANDROID` |
| `appVersion` | string | `2.1.3` |
| `osVersion` | string | `Android 14` |
| `notificationsEnabled` | boolean | `true` |

Gravados na tabela `user_app_client_state` (1 linha por usuário; `last_seen_at` definido no servidor a cada login). Login sem esses campos continua válido.

```json
{
  "cpf": "12345678909",
  "password": "senha12345",
  "platform": "IOS",
  "appVersion": "2.1.3",
  "osVersion": "iOS 17.4",
  "notificationsEnabled": true
}
```

---

### `PATCH` `/auth/password`

**Resumo:** Atualizar a senha do usuário autenticado

**Funcionalidade:** ver detalhes e parâmetros no [Swagger](pathname:///docs) (tag correspondente).

---

### `POST` `/auth/password/reset`

**Resumo:** Resetar senha com token

**Funcionalidade:**

Redefine a senha do usuário (estudante, admin, etc.) usando o `resetToken` retornado por
`POST /auth/verification/verify` após o fluxo com `purpose` `user_password_reset` (código no WhatsApp).

---

### `POST` `/auth/password/validate`

**Resumo:** Validar token de reset de senha

**Funcionalidade:**

Verifica se um token de reset de senha é válido e retorna informações sobre ele

---

### `POST` `/auth/refresh`

**Resumo:** Obter novo access token usando refresh token

**Funcionalidade:**

Gera um novo access token válido a partir de um refresh token.
O refresh token deve ter sido obtido no login e tem validade de 30 dias.

---

### `POST` `/auth/register`

**Resumo:** Registrar um novo usuário

**Funcionalidade:**

Cadastra um novo usuário no sistema (estudantes, administradores, etc.).

**Obrigatório:** antes, concluir `POST /auth/verification/request` (purpose `signup`) e `POST /auth/verification/verify`
e enviar o `phoneVerificationToken` retornado. O campo `phone` deste cadastro deve corresponder ao telefone validado.

Para persona **STUDENT**, após o cadastro o sistema enfileira email de boas-vindas (fila/worker) e grava uma notificação in-app de boas-vindas (`GET /students/notifications`, `metadata.kind` = `WELCOME`).

---

### `POST` `/auth/verification/request`

**Resumo:** Solicitar código no WhatsApp (cadastro ou esqueci minha senha)

**Funcionalidade:**

Inicia uma verificação via **Twilio Verify** (canal WhatsApp). Requer variáveis de ambiente da Twilio no servidor.

- **signup:** envia código para o telefone informado. Resposta `201` com `challengeId` quando o envio foi iniciado.
- **user_password_reset:** envia código para o telefone **cadastrado** do usuário com o **CPF** informado (se existir).
  Resposta `200` com mensagem genérica quando o CPF não existe ou não há telefone — sem vazar existência de conta.

---

### `POST` `/auth/verification/verify`

**Resumo:** Validar código do WhatsApp

**Funcionalidade:**

Confirma o código recebido no WhatsApp.

- **signup:** resposta inclui `phoneVerificationToken` (curta validade) — envie em `POST /auth/register` no campo homônimo.
- **user_password_reset:** resposta inclui `resetToken` para `POST /auth/password/reset`.

---

