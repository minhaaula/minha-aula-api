---
sidebar_position: 8
title: Público & cadastro escola
---

# API pública e cadastro de escola

Rotas usadas com **módulo schools** ativo: listagem de escolas, cadastro, login de escola, categorias e planos. Parte delas também aparece quando só o app de estudantes expõe categorias.

> Referência técnica completa: [Swagger UI](pathname:///docs) · [OpenAPI JSON](pathname:///docs/openapi.json)

## Endpoints (7)

### `GET` `/schools`

**Resumo:** Listar escolas

**Funcionalidade:**

Endpoint de leitura para seleção de escolas por alunos.

---

### `POST` `/schools`

**Resumo:** Criar uma nova escola

**Funcionalidade:**

Cria uma escola e o usuário responsável. O cadastro exige confirmação por **OTP no WhatsApp** do responsável (`ownerWhatsapp` e token de verificação retornado pelo fluxo `/schools/verification/*`, quando habilitado).

O **CNPJ** é **opcional**: informe 14 dígitos para pessoa jurídica; omita ou use `null` para **pessoa física** — nesse caso o **CPF do titular** é usado na cobrança do plano e na integração Asaas (subconta como pessoa física).

Se um token Bearer de uma escola já existente for enviado, essa escola será definida como proprietária.

---

### `GET` `/schools/categories`

**Resumo:** Listar categorias e subcategorias disponíveis

**Funcionalidade:**

Retorna as categorias de cursos e suas respectivas subcategorias.
**Disponível também quando a API está rodando apenas com o módulo students** (ex.: API de estudantes em produção). Não requer autenticação.

---

### `POST` `/schools/login`

**Resumo:** Autenticar uma escola

**Funcionalidade:**

Autentica uma escola e retorna um token de acesso. A resposta inclui informações sobre o status do onboarding (KYC):
- `onboardingCompleted`: indica se o processo de onboarding foi finalizado (true quando a escola tem accountId e accountApiKey)
- `onboardingUrl`: link para completar o onboarding (retornado apenas quando onboardingCompleted é false)

---

### `GET` `/schools/plan/invoices`

**Resumo:** Listar faturas do plano

**Funcionalidade:**

Retorna todas as faturas geradas para o plano da escola, incluindo cobranças pendentes (status ISSUED) e quitadas (status PAID). Use este endpoint antes de realizar o pagamento de um boleto.

---

### `POST` `/schools/plan/invoices`

**Resumo:** Gerar fatura do plano vigente

**Funcionalidade:**

Emite uma nova fatura para o plano atual da escola. Informe opcionalmente uma data de vencimento específica ou uma descrição para o boleto. Se já existir uma fatura na mesma data, ela será reutilizada.
**Cupons de desconto:** Se um `couponCode` for fornecido e o cupom tiver `durationMonths > 1`, o sistema gerará automaticamente múltiplas faturas (uma para cada mês) até o limite da duração do cupom ou até a data de validade do cupom. Todas as faturas geradas terão o desconto aplicado.

---

### `GET` `/schools/plans`

**Resumo:** Listar planos disponíveis para escolas

**Funcionalidade:**

Retorna os planos de assinatura disponíveis para contratação.

---

