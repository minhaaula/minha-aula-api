---
sidebar_position: 3
title: Admin (rotas)
---

# Admin — rotas

Painel administrativo (**persona ADMIN**). Gestão de escolas, planos, categorias, fila, visões financeiras e suporte a KYC/Asaas.

> Referência técnica completa: [Swagger UI](pathname:///docs) · [OpenAPI JSON](pathname:///docs/openapi.json)

## Endpoints (36)

### `GET` `/admin/categories`

**Resumo:** Listar categorias

**Funcionalidade:**

Retorna todas as categorias com suas subcategorias para gestão no painel admin. Ordenadas por nome. Requer autenticação com persona ADMIN.

---

### `POST` `/admin/categories`

**Resumo:** Cadastrar categoria

**Funcionalidade:**

Cria uma nova categoria. O nome deve ser único. Subcategorias opcionais. Requer autenticação com persona ADMIN.

---

### `PATCH` `/admin/categories/\{categoryId\}`

**Resumo:** Editar categoria

**Funcionalidade:**

Atualiza uma categoria existente. Campos do body opcionais. Nome deve ser único se informado. Subcategorias substituem a lista atual. Requer autenticação com persona ADMIN.

---

### `POST` `/admin/charge-due-reminders/trigger`

**Resumo:** Disparar job de lembretes de cobrança

**Funcionalidade:**

Dispara imediatamente o job de lembretes de vencimento: busca cobranças e faturas
que vencem em até 10 dias, registra no banco (para não reenviar) e enfileira um email
de lembrete para cada uma na fila. O worker processa a fila e envia os emails.
Requer autenticação com persona ADMIN.

---

### `POST` `/admin/charges/\{chargeId\}/mark-paid`

**Resumo:** Dar baixa em cobrança (aluno)

**Funcionalidade:**

Marca uma cobrança de aluno (mensalidade, taxa de matrícula, etc.) como paga manualmente (dar baixa).
Se a cobrança tiver PIX ou boleto no Asaas, o pagamento é marcado como recebido no Asaas (receiveInCash).
Use quando o pagamento foi confirmado fora do sistema ou para corrigir status.
Só é possível dar baixa em cobranças com status OPEN, PENDING_SYNC, OVERDUE ou FAILED. Não permite cobrança cancelada.
Requer autenticação com persona ADMIN.

---

### `GET` `/admin/dashboard`

**Resumo:** Obter dados consolidados do dashboard

**Funcionalidade:**

Retorna informações consolidadas para o dashboard administrativo:
- KPIs: total de escolas, alunos, turmas, escolas ativas/inadimplentes,
  matrículas no mês, faturamento escolas/plataforma, inadimplência total
- Receita plataforma e faturamento escolas por mês (últimos 6 meses)
- Top escolas por quantidade de alunos
- Status dos pagamentos do mês (Pago, Emitido, Atrasado)
- Últimas escolas cadastradas

Requer autenticação com persona ADMIN.

---

### `GET` `/admin/enrollment-requests`

**Resumo:** Listar pedidos de matrícula de todas as escolas

**Funcionalidade:**

Retorna pedidos de matrícula de todas as escolas, paginado e com filtros por
nome do aluno, CPF do aluno e nome da escola.

---

### `POST` `/admin/invoices/\{invoiceId\}/mark-paid`

**Resumo:** Dar baixa em fatura (escola)

**Funcionalidade:**

Marca uma fatura de plano da escola como paga manualmente (dar baixa).
Use quando o pagamento foi confirmado fora do sistema ou para corrigir status.
Só é possível dar baixa em faturas com status ISSUED ou FAILED.
Requer autenticação com persona ADMIN.

---

### `POST` `/admin/login`

**Resumo:** Autenticar administrador

**Funcionalidade:**

Autentica um usuário administrador usando email e senha.
Apenas usuários com persona ADMIN podem fazer login através desta rota.

---

### `GET` `/admin/payment-history`

**Resumo:** Listar histórico de pagamentos

**Funcionalidade:**

Retorna o histórico de pagamentos das escolas com a Minha Aula (faturas de plano de assinatura).
Paginado e com filtros por nome da escola, status, mês e ano.

---

### `GET` `/admin/plans`

**Resumo:** Listar planos de assinatura

**Funcionalidade:**

Retorna todos os planos de assinatura (ativos e inativos) para gestão no painel admin. Ordenados por valor (amountCents). Requer autenticação com persona ADMIN.

---

### `POST` `/admin/plans`

**Resumo:** Cadastrar plano de assinatura

**Funcionalidade:**

Cria um novo plano de assinatura. O código deve ser único. Requer autenticação com persona ADMIN.

---

### `PATCH` `/admin/plans/\{planId\}`

**Resumo:** Editar plano de assinatura

**Funcionalidade:**

Atualiza um plano existente. Campos do body opcionais. Código deve ser único se informado. Requer autenticação com persona ADMIN.

---

### `GET` `/admin/queue/jobs`

**Resumo:** Listar jobs da fila (BullMQ)

**Funcionalidade:**

Retorna o status da fila de jobs (outbox): jobs repetitivos agendados, contagens
(waiting, active, completed, failed), workers ativos e amostras de jobs em cada estado.
Requer autenticação com persona ADMIN.
Se REDIS_HOST não estiver configurado, retorna 503.

---

### `GET` `/admin/schools`

**Resumo:** Listar escolas com planos e status

**Funcionalidade:**

Retorna as escolas cadastradas com informações do plano de assinatura atual e seu status.
Suporta filtros por nome, status, mensalidade, CNPJ, CPF do titular, conta Asaas, onboardingUrl,
primeiro pagamento e onboarding concluído. Requer autenticação com persona ADMIN.

---

### `GET` `/admin/schools/\{schoolId\}`

**Resumo:** Obter detalhes completos de uma escola

**Funcionalidade:**

Retorna os detalhes completos de uma escola para uso administrativo, incluindo:
- Dados cadastrais completos
- Informações do responsável
- Receita estimada (`incomeValue`)
- Informações do plano de assinatura atual (se houver)
- Dados da conta no provedor de pagamentos (Asaas)
- Status de onboarding/KYC

Requer autenticação com persona ADMIN.

---

### `PATCH` `/admin/schools/\{schoolId\}`

**Resumo:** Atualizar dados de uma escola

**Funcionalidade:**

Atualiza dados cadastrais e de configuração de uma escola.

- Permite alterar nome, email, telefone e CNPJ
- Permite atualizar informações do responsável
- Permite ajustar `incomeValue` e links públicos da escola
- Retorna sempre a visão administrativa completa da escola após a atualização

Requer autenticação com persona ADMIN.

---

### `GET` `/admin/schools/\{schoolId\}/billing`

**Resumo:** Listar faturamento da escola

**Funcionalidade:**

Retorna o faturamento da escola por ID: resumo (Total Ganho, Pendente, Atrasado, Saldo Atual)
e consolidado por mês/ano (ganho, pendente, atrasado e total por período).

---

### `GET` `/admin/schools/\{schoolId\}/courses`

**Resumo:** Listar cursos da escola

**Funcionalidade:**

Retorna a listagem de cursos ativos da escola pelo ID da escola.
Inclui nome, descrição, categorias/subcategorias e data de criação.

Requer autenticação com persona ADMIN.

---

### `POST` `/admin/schools/\{schoolId\}/documents/\{documentGroupId\}/upload`

**Resumo:** Enviar documento de onboarding para Asaas (manual)

**Funcionalidade:**

Envia um documento para um grupo pendente da subconta Asaas da escola (POST /v3/myAccount/documents/\{id\}).
Use quando o onboardingUrl não estiver disponível (envio manual). O documentGroupId e o type vêm da lista
retornada por POST /admin/schools/\{schoolId\}/sync-onboarding-documents.
Requer autenticação com persona ADMIN.
Tipos aceitos: IDENTIFICATION, IDENTIFICATION_SELFIE, MINUTES_OF_ELECTION, SOCIAL_CONTRACT, OTHER.
Arquivos: PDF ou imagem (JPEG/PNG), até 10MB.

---

### `GET` `/admin/schools/\{schoolId\}/financial`

**Resumo:** Listar financeiro da escola

**Funcionalidade:**

Retorna o resumo financeiro da escola por ID: saldo disponível, total ganho,
valores pendentes, atrasados e a lista de solicitações de saque.

---

### `POST` `/admin/schools/\{schoolId\}/generate-asaas-account`

**Resumo:** Gerar conta Asaas da escola

**Funcionalidade:**

Gera (ou recria) a conta Asaas (subconta) para uma escola. Use esta rota quando
houver falha no fluxo automático (ex. primeira fatura, webhook) e for necessário
criar a conta manualmente.

Comportamento idêntico a `resend-asaas-account`:
- Cria/atualiza a subconta no Asaas com os dados da escola
- Atualiza a escola com accountId, accountApiKey e walletId
- Busca o link de onboarding (KYC) após 15 segundos

**Requisitos:** Escola com endereço completo (rua, número, CEP 8 dígitos). Asaas configurado.
Requer autenticação com persona ADMIN.

---

### `GET` `/admin/schools/\{schoolId\}/invoices`

**Resumo:** Listar invoices (faturas) da escola

**Funcionalidade:**

Retorna todas as faturas de plano de assinatura da escola (por ID),
incluindo planos ativos e históricos. Ordenadas por data de vencimento (mais recente primeiro).

---

### `GET` `/admin/schools/\{schoolId\}/payments`

**Resumo:** Listar cobranças financeiras da escola (visão mensal)

**Funcionalidade:**

Retorna as cobranças financeiras de uma escola em um determinado mês/ano,
incluindo informações do aluno, curso, turma, valores e status.

Esta rota é apenas de visualização para o painel administrativo.

---

### `GET` `/admin/schools/\{schoolId\}/payments/paid`

**Resumo:** Listar pagamentos já recebidos da escola

**Funcionalidade:**

Retorna o histórico de cobranças já pagas de uma escola, com paginação
e filtro por nome do aluno.

Esta rota é apenas de visualização para o painel administrativo.

---

### `GET` `/admin/schools/\{schoolId\}/plans`

**Resumo:** Obter histórico de planos de uma escola

**Funcionalidade:**

Retorna o plano de assinatura atual e o histórico de planos de uma escola.

Requer autenticação com persona ADMIN.

---

### `POST` `/admin/schools/\{schoolId\}/resend-asaas-account`

**Resumo:** Reenviar solicitação de conta Asaas para escola

**Funcionalidade:**

Reenvia a solicitação de criação de conta no Asaas para uma escola específica.
Útil quando há falhas de comunicação durante a criação inicial da escola.

Esta rota:
- Cria/atualiza a subconta no Asaas com os dados da escola
- Atualiza a escola com accountId, accountApiKey e walletId
- Busca o link de onboarding (KYC) após 15 segundos
- Retorna os dados atualizados da conta

**Requisitos:**
- Escola deve ter pelo menos um endereço completo (rua, número e CEP com 8 dígitos)
- Asaas provider deve estar configurado

Requer autenticação com persona ADMIN.

---

### `GET` `/admin/schools/\{schoolId\}/students`

**Resumo:** Listar alunos de uma escola

**Funcionalidade:**

Retorna a lista de titulares (alunos USER) matriculados na escola, cada um
com um array de dependentes (nome, cpf, data nascimento, vínculo) na mesma linha.
Campos por aluno: cpf, studentId, studentName, studentType, endereco, createdAt, dependentes.

Esta rota é apenas de visualização para o painel administrativo.

---

### `GET` `/admin/schools/\{schoolId\}/students/\{studentId\}/payments`

**Resumo:** Listar pagamentos de um aluno na escola

**Funcionalidade:**

Retorna o histórico de cobranças pagas de um aluno (usuário ou dependente)
dentro de uma escola específica.

Esta rota é apenas de visualização para o painel administrativo.

---

### `POST` `/admin/schools/\{schoolId\}/sync-onboarding-documents`

**Resumo:** Sincronizar documentos e onboarding (Asaas)

**Funcionalidade:**

Consulta no Asaas os documentos pendentes da escola (GET /v3/myAccount/documents)
e atualiza a onboardingUrl salva na escola quando disponível.
Conforme documentação Asaas: após criar a subconta, recomenda-se aguardar 15 segundos
antes da primeira consulta; para escolas já com conta, pode ser chamado a qualquer momento.
Use quando não houver confiança de que o onboarding_url foi enviado/atualizado (ex. job falhou).
Retorna a lista de grupos de documentos e a URL para redirecionar o cliente ao envio via link (cadastro.io).
Requer autenticação com persona ADMIN.

---

### `POST` `/admin/schools/\{schoolId\}/sync-subaccount-status`

**Resumo:** Consultar status da subconta Asaas

**Funcionalidade:**

Consulta no Asaas o status cadastral da subconta da escola (GET /v3/myAccount/status)
e retorna os dados. Não persiste o status; a informação vem direto da API.
Quando commercialInfo, bankAccountInfo, documentation e general estiverem todos APPROVED,
marca o onboarding como concluído (onboardingCompletedAt) no nosso lado.
Requer autenticação com persona ADMIN.

---

### `GET` `/admin/status`

**Resumo:** Obter status do sistema

**Funcionalidade:**

Retorna informações sobre módulos ativos, arquivos OpenAPI carregados e informações do ambiente.

---

### `GET` `/admin/students`

**Resumo:** Listar todos os estudantes do sistema

**Funcionalidade:**

Retorna a lista de titulares (alunos USER) do sistema, paginada e com filtros por nome, escola e CPF.
Cada item traz apenas os campos cpf, studentId, studentName, studentType (USER), endereco, createdAt,
countCursos (quantidade de cursos/turmas vinculados) e um array dependentes (id, nome, cpf, dataNascimento, vinculo)
para exibir os dependentes na mesma linha do titular.

---

### `GET` `/admin/students/\{studentId\}`

**Resumo:** Obter detalhes do estudante por ID

**Funcionalidade:**

Retorna os detalhes do aluno pelo ID: dados do aluno (studentType USER ou DEPENDENT),
responsável (quando dependente), matrículas e cobranças pagas em todas as escolas,
e array de dependentes com seus dados e matrículas quando o aluno for titular (USER).
Cada matrícula e cobrança inclui a escola (id e name).

---

### `GET` `/admin/students/\{studentId\}/charges`

**Resumo:** Listar mensalidades do aluno (todas as escolas)

**Funcionalidade:**

Retorna todas as cobranças (mensalidades) do aluno em todos os cursos e escolas.
Rota apenas por studentId (sem schoolId). Quando studentId é o titular (USER), inclui
as cobranças desse usuário e as cobranças de todos os seus dependentes. Quando studentId
é um dependente, retorna apenas as cobranças daquele dependente.

---

### `GET` `/admin/students/\{studentId\}/courses`

**Resumo:** Listar cursos do aluno e dos dependentes (todas as escolas)

**Funcionalidade:**

Lista todos os cursos (matrículas) do aluno pelo ID, em qualquer escola.
Se o aluno for titular (USER), retorna também os cursos de cada um dos seus dependentes,
agrupados por dependente. Cada item inclui a escola (id e name) para identificar a origem.

Requer persona ADMIN.

---

