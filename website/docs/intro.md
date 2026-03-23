---
sidebar_position: 1
title: Visão geral
---

# Minha Aula API — Documentação

Esta documentação descreve **funcionalidades** e **fluxos** da API REST (Clean Architecture), alinhada aos **módulos** ativados por `APP_MODULES`: `auth`, `admin`, `payments`, `schools`, `students`.

## Personas

| Persona | Uso típico |
|---------|------------|
| **ADMIN** | Operação do sistema, escolas, planos |
| **SCHOOL** | Gestão da escola, cursos, turmas, financeiro |
| **STUDENT** | App do aluno/responsável — matrículas, pagamentos, dependentes |

## Referência interativa (Swagger)

A especificação **OpenAPI** e o **playground** Swagger UI ficam na mesma origem da API:

- **Swagger UI** — na mesma origem da API, abra o caminho <code>/docs</code> no navegador para explorar e testar endpoints (em produção pode exigir autenticação básica).
- **`GET /docs/openapi.json`** — spec em JSON para importar em Postman, Insomnia, etc.

## Módulos (guia)

Use a barra lateral **Módulos da API (visão geral)** para o contexto de cada área.

Em **Rotas — funcionalidade por endpoint** está o detalhe **rota a rota** (método, caminho, resumo e texto funcional copiado do OpenAPI), gerado pelo script `scripts/generate-docusaurus-route-docs.mjs` a partir de `docs/*.yaml`.

## Ambiente

Configure variáveis conforme o `README` do repositório (`AUTH_TOKEN_SECRET`, `ASAAS_API_KEY`, banco, Redis para filas, etc.). Módulos não carregados não expõem rotas correspondentes.
