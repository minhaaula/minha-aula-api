---
sidebar_position: 1
title: Módulo Auth
---

# Módulo Auth

Cadastro e autenticação de usuários com **JWT** (access + refresh). Suporta personas incluindo **STUDENT**, **ADMIN** e **OPERATION** (conforme regras do sistema).

## Funcionalidades

- **Registro** (`POST /auth/register`) — cria usuário com endereço e CPF; persona define o perfil.
- **Login** (`POST /auth/login`) — retorna tokens; escolas (`SCHOOL`) usam fluxo próprio em `/schools/login`.
- **Refresh** (`POST /auth/refresh`) — renova access token.
- **Senha** — atualização autenticada, fluxo de esqueci senha (tokens de reset) quando configurado.

## Estudante (STUDENT)

Após cadastro com persona estudante, o backend pode enfileirar **email de boas-vindas** e gravar **notificação in-app** (lista em `GET /students/notifications`).

## OpenAPI

Arquivo de referência: `docs/auth.yaml` (no repositório da API).

## Variáveis relevantes

- `AUTH_TOKEN_SECRET` — obrigatório (mín. 32 caracteres).
- `FRONTEND_BASE_URL` — links em emails (login, confirmação).
- Provedor de email para confirmação e reset, quando habilitado.

## Cada rota (detalhe)

[Auth — rotas e funcionalidades](/modules/routes/auth)
