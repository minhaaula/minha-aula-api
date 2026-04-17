---
sidebar_position: 1
title: Auth (rotas)
---

# Auth — rotas

Autenticação de **usuários** (não escola). Personas incluem STUDENT, ADMIN, OPERATION. Escolas usam `/schools/login`.

> Referência técnica completa: [Swagger UI](pathname:///docs) · [OpenAPI JSON](pathname:///docs/openapi.json)

**WhatsApp (Twilio Verify):** cadastro e “esqueci minha senha” exigem confirmação por código enviado ao WhatsApp (servidor com `TWILIO_*` configurado). Não existe mais `POST /auth/password/request` (reset só por e-mail).

## Endpoints (8)

### `POST` `/auth/verification/request`

**Resumo:** Solicitar código no WhatsApp (cadastro ou recuperação de senha)

**Funcionalidade:**

Corpo com `purpose`: `signup` (e `phone`) ou `user_password_reset` (e `email`). Inicia verificação Twilio Verify; em caso de sucesso retorna `challengeId` para o passo seguinte.

---

### `POST` `/auth/verification/verify`

**Resumo:** Validar código recebido no WhatsApp

**Funcionalidade:**

Envia `challengeId` e `code`. Para `signup`, a resposta inclui `phoneVerificationToken` para usar em `POST /auth/register`. Para recuperação de senha, inclui `resetToken` para `POST /auth/password/reset`.

---

### `POST` `/auth/register`

**Resumo:** Registrar um novo usuário

**Funcionalidade:**

Exige `phoneVerificationToken` obtido após o fluxo de verificação do WhatsApp (mesmo telefone em `phone`). Cadastra estudantes, administradores etc. Para persona **STUDENT**, após o cadastro o sistema pode enfileirar email de boas-vindas e notificação in-app (`GET /students/notifications`, `metadata.kind` = `WELCOME`).

---

### `POST` `/auth/login`

**Resumo:** Autenticar usuário e gerar tokens de acesso

**Funcionalidade:**

Autentica um usuário e retorna um access token (validade curta) e um refresh token (validade de 30 dias).
O refresh token deve ser usado para obter novos access tokens quando o atual expirar.

---

### `POST` `/auth/refresh`

**Resumo:** Obter novo access token usando refresh token

**Funcionalidade:**

Gera um novo access token válido a partir de um refresh token.
O refresh token deve ter sido obtido no login e tem validade de 30 dias.

---

### `PATCH` `/auth/password`

**Resumo:** Atualizar a senha do usuário autenticado

**Funcionalidade:** ver detalhes e parâmetros no [Swagger](pathname:///docs) (tag correspondente).

---

### `POST` `/auth/password/reset`

**Resumo:** Resetar senha com token

**Funcionalidade:**

Redefine a senha usando o `resetToken` retornado por `POST /auth/verification/verify` após o fluxo com `user_password_reset` (não é mais obtido por e-mail neste passo).

---

### `POST` `/auth/password/validate`

**Resumo:** Validar token de reset de senha

**Funcionalidade:**

Verifica se um token de reset de senha é válido e retorna informações sobre ele

---
