---
sidebar_position: 1
title: Swagger e OpenAPI
---

# Referência OpenAPI (Swagger)

A API expõe a documentação interativa gerada a partir dos arquivos YAML em `docs/*.yaml` do repositório, mesclados em tempo de execução.

## Onde acessar

Na mesma origem da API (fora do portal estático `/portal`):

| Recurso | Caminho |
|--------|---------|
| **Swagger UI** | `/docs` |
| **Spec JSON** | `/docs/openapi.json` |

Em **produção**, o Swagger pode estar protegido por autenticação HTTP básica (`SWAGGER_USERNAME` / `SWAGGER_PASSWORD`).

## Módulos e arquivos YAML

Conforme `MODULE_DOC_FILES` no código:

| Módulo `APP_MODULES` | Arquivos OpenAPI típicos |
|----------------------|---------------------------|
| auth | `auth.yaml` |
| admin | `admin.yaml` |
| payments | `payments.yaml` |
| schools | `schools.yaml`, `students.yaml`, `webhooks.yaml` |
| students | `students.yaml`, `dependents.yaml`, `enrollment-requests.yaml`, `schools-public.yaml` |

Sempre há `health.yaml` na base.

## Ferramentas externas

Importe `/docs/openapi.json` no **Postman**, **Insomnia** ou **Bruno** para gerar coleções e testar contra o mesmo ambiente.
