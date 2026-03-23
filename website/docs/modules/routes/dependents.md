---
sidebar_position: 6
title: Dependents (rotas)
---

# Dependents — rotas

CRUD de **dependentes** do responsável autenticado (STUDENT).

> Referência técnica completa: [Swagger UI](pathname:///docs) · [OpenAPI JSON](pathname:///docs/openapi.json)

## Endpoints (4)

### `GET` `/dependents`

**Resumo:** Listar dependentes do estudante logado

**Funcionalidade:**

Retorna todos os dependentes cadastrados pelo usuário autenticado. Requer persona STUDENT.

---

### `POST` `/dependents`

**Resumo:** Cadastrar um novo dependente para o usuário autenticado

**Funcionalidade:**

Disponível apenas para usuários com persona STUDENT.

---

### `PUT` `/dependents/\{id\}`

**Resumo:** Editar um dependente

**Funcionalidade:**

Atualiza os dados de um dependente do usuário autenticado.
O CPF não pode ser alterado. Apenas nome completo, data de nascimento e relacionamento podem ser atualizados.
Requer persona STUDENT.

---

### `DELETE` `/dependents/\{id\}`

**Resumo:** Deletar um dependente

**Funcionalidade:**

Realiza soft delete de um dependente do usuário autenticado.
Não é possível deletar um dependente que possui matrículas ativas ou solicitações de matrícula pendentes em escolas.
Requer persona STUDENT.

---

