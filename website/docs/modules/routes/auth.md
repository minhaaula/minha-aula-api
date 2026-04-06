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

---

### `PATCH` `/auth/password`

**Resumo:** Atualizar a senha do usuário autenticado

**Funcionalidade:** ver detalhes e parâmetros no [Swagger](pathname:///docs) (tag correspondente).

---

### `POST` `/auth/password/request`

**Resumo:** Solicitar reset de senha

**Funcionalidade:**

Envia um token de reset de senha para o email do usuário (estudante, admin, etc.)

---

### `POST` `/auth/password/reset`

**Resumo:** Resetar senha com token

**Funcionalidade:**

Redefine a senha do usuário (estudante, admin, etc.) usando o token recebido

---

### `POST` `/auth/password/validate`

**Resumo:** Validar token de reset de senha

**Funcionalidade:**

Verifica se um token de reset de senha é válido e retorna informações sobre ele

---

### `PATCH` `/auth/password/validate`

**Resumo:** Alterar senha do usuário logado

**Funcionalidade:**

Permite que um usuário autenticado (estudante, admin, etc.) altere sua própria senha

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

Para persona **STUDENT**, após o cadastro o sistema enfileira email de boas-vindas (fila/worker) e grava uma notificação in-app de boas-vindas (`GET /students/notifications`, `metadata.kind` = `WELCOME`).

---

