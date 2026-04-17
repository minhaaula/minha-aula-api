---
sidebar_position: 1
title: Módulo Auth
---

# Módulo Auth

Cadastro e autenticação de usuários com **JWT** (access + refresh). Suporta personas incluindo **STUDENT**, **ADMIN** e **OPERATION** (conforme regras do sistema).

## Funcionalidades

- **Verificação WhatsApp** (`POST /auth/verification/request` + `/auth/verification/verify`) — obrigatória antes do registro e para “esqueci minha senha” (Twilio Verify).
- **Registro** (`POST /auth/register`) — exige `phoneVerificationToken`; cria usuário com endereço e CPF; persona define o perfil.
- **Login** (`POST /auth/login`) — retorna tokens; escolas (`SCHOOL`) usam fluxo próprio em `/schools/login`.
- **Refresh** (`POST /auth/refresh`) — renova access token.
- **Senha** — atualização autenticada (`PATCH /auth/password`); recuperação com código no WhatsApp e `resetToken` em `/auth/password/reset`.

## Estudante (STUDENT)

Após cadastro com persona estudante, o backend pode enfileirar **email de boas-vindas** e gravar **notificação in-app** (lista em `GET /students/notifications`).

## OpenAPI

Arquivo de referência: `docs/auth.yaml` (no repositório da API).

## Variáveis relevantes

- `AUTH_TOKEN_SECRET` — obrigatório (mín. 32 caracteres).
- `FRONTEND_BASE_URL` — links em emails (login, confirmação).
- **Twilio Verify** — `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_VERIFY_SERVICE_SID` — necessários para envio/validação de código no WhatsApp (cadastro e reset de senha).
- Provedor de email para mensagens transacionais, quando habilitado.

## Cada rota (detalhe)

[Auth — rotas e funcionalidades](/modules/routes/auth)
