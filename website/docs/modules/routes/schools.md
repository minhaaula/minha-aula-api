---
sidebar_position: 4
title: Schools (rotas)
---

# Schools — rotas

Gestão da **escola** autenticada (**persona SCHOOL**): perfil, cursos, turmas, alunos, financeiro, plano, notificações, contas bancárias, imagens e KYC.

> Referência técnica completa: [Swagger UI](pathname:///docs) · [OpenAPI JSON](pathname:///docs/openapi.json)

## Endpoints (57)

### `POST` `/schools`

**Resumo:** Criar uma nova escola

**Funcionalidade:**

Cria uma nova escola e automaticamente cria uma subconta no Asaas para processamento de pagamentos.
O sistema busca o link de onboarding (KYC) e retorna no campo `kycUrl` para que o frontend possa
redirecionar o usuário para completar a verificação de identidade.

---

### `GET` `/schools/bank-accounts`

**Resumo:** Listar contas bancárias da escola

**Funcionalidade:**

Retorna todas as contas bancárias cadastradas para a escola autenticada.

---

### `POST` `/schools/bank-accounts`

**Resumo:** Criar uma nova conta bancária

**Funcionalidade:**

Adiciona uma nova conta bancária para a escola autenticada.

---

### `PUT` `/schools/bank-accounts/\{accountId\}`

**Resumo:** Atualizar uma conta bancária

**Funcionalidade:**

Atualiza os dados de uma conta bancária existente da escola autenticada.

---

### `DELETE` `/schools/bank-accounts/\{accountId\}`

**Resumo:** Deletar uma conta bancária

**Funcionalidade:**

Remove uma conta bancária da escola autenticada.

---

### `GET` `/schools/categories`

**Resumo:** Listar categorias e subcategorias disponíveis

**Funcionalidade:**

Retorna as categorias de cursos e suas respectivas subcategorias para auxiliar na criação de cursos.

---

### `POST` `/schools/coupons/validate`

**Resumo:** Validar cupom de desconto

**Funcionalidade:**

Valida um cupom de desconto e retorna informações sobre o desconto aplicado. Se um planId for fornecido, calcula o valor de desconto baseado no preço do plano.

---

### `GET` `/schools/courses`

**Resumo:** Listar cursos da escola

**Funcionalidade:** ver detalhes e parâmetros no [Swagger](pathname:///docs) (tag correspondente).

---

### `POST` `/schools/courses`

**Resumo:** Criar um curso para uma escola

**Funcionalidade:**

Cria um novo curso para a escola. O campo opcional `monthlyPriceCents` define o preço mensal do curso
em centavos (ex: 15000 = R$ 150,00). Este valor será automaticamente copiado para o campo `fullAmountCents`
das matrículas criadas para turmas deste curso, servindo como base para cálculo de descontos.

---

### `GET` `/schools/courses/classes`

**Resumo:** Listar turmas da escola

**Funcionalidade:**

Retorna a lista de todas as turmas da escola, opcionalmente filtradas por curso.
Cada turma inclui o campo `monthlyPriceCents` com o valor da mensalidade em centavos.

---

### `GET` `/schools/courses/\{courseId\}`

**Resumo:** Obter detalhes de um curso da escola

**Funcionalidade:** ver detalhes e parâmetros no [Swagger](pathname:///docs) (tag correspondente).

---

### `PUT` `/schools/courses/\{courseId\}`

**Resumo:** Atualizar um curso da escola

**Funcionalidade:** ver detalhes e parâmetros no [Swagger](pathname:///docs) (tag correspondente).

---

### `DELETE` `/schools/courses/\{courseId\}`

**Resumo:** Desativar um curso da escola

**Funcionalidade:** ver detalhes e parâmetros no [Swagger](pathname:///docs) (tag correspondente).

---

### `GET` `/schools/courses/\{courseId\}/classes`

**Resumo:** Listar turmas de um curso

**Funcionalidade:**

Retorna a lista de turmas de um curso específico.
Cada turma inclui o campo `monthlyPriceCents` com o valor da mensalidade em centavos.

---

### `POST` `/schools/courses/\{courseId\}/classes`

**Resumo:** Criar uma turma para um curso

**Funcionalidade:**

Cria uma nova turma para o curso especificado. O campo opcional `monthlyPriceCents` define o valor da mensalidade
específica desta turma. Se não informado, o sistema pode usar o valor do curso como padrão.

---

### `GET` `/schools/courses/\{courseId\}/classes/\{classId\}`

**Resumo:** Obter detalhes de uma turma

**Funcionalidade:**

Retorna os detalhes completos de uma turma específica, incluindo o campo `monthlyPriceCents`
com o valor da mensalidade em centavos.

---

### `PUT` `/schools/courses/\{courseId\}/classes/\{classId\}`

**Resumo:** Atualizar uma turma do curso

**Funcionalidade:**

Atualiza os dados de uma turma existente. O campo opcional `monthlyPriceCents` permite definir ou atualizar
o valor da mensalidade específica desta turma.

---

### `DELETE` `/schools/courses/\{courseId\}/classes/\{classId\}`

**Resumo:** Remover uma turma de um curso

**Funcionalidade:** ver detalhes e parâmetros no [Swagger](pathname:///docs) (tag correspondente).

---

### `POST` `/schools/courses/\{courseId\}/classes/\{classId\}/enrollments`

**Resumo:** Matricular aluno diretamente na turma

**Funcionalidade:**

Cria uma matrícula vinculando um aluno (ou dependente) a uma turma específica.

O sistema utiliza o valor do campo `monthlyPriceCents` da turma (se definido) ou do curso relacionado
para preencher o campo `fullAmountCents` da matrícula. Este valor cheio pode ser usado posteriormente como
base para cálculo de descontos.

**Notificações ao aluno:** enfileira email de confirmação de matrícula e grava notificação in-app (`metadata.kind` = `ENROLLMENT_CONFIRMED`).

---

### `GET` `/schools/courses/\{courseId\}/classes/\{classId\}/requests`

**Resumo:** Listar solicitações de matrícula de uma turma

**Funcionalidade:**

Retorna as solicitações de matrícula da turma, pendentes por padrão.

---

### `GET` `/schools/courses/\{courseId\}/classes/\{classId\}/sessions`

**Resumo:** Listar sessões de aula de uma turma

**Funcionalidade:** ver detalhes e parâmetros no [Swagger](pathname:///docs) (tag correspondente).

---

### `POST` `/schools/courses/\{courseId\}/classes/\{classId\}/sessions`

**Resumo:** Agendar uma sessão de aula para a turma

**Funcionalidade:** ver detalhes e parâmetros no [Swagger](pathname:///docs) (tag correspondente).

---

### `GET` `/schools/dashboard`

**Resumo:** Dados consolidados para o dashboard da escola

**Funcionalidade:**

Retorna métricas, histórico de receita, pagamentos em atraso e matrículas recentes para a escola autenticada.

---

### `GET` `/schools/finance/balance`

**Resumo:** Obter saldo da escola no Asaas

**Funcionalidade:**

Retorna o saldo atual da conta Asaas da escola, incluindo saldo total, saldo disponível e saldo bloqueado.

**Requisitos:**
- A escola deve ter uma conta Asaas configurada (accountId e accountApiKey)
- Se a escola não tiver conta Asaas, retorna valores zerados

**Nota:** O saldo é buscado diretamente da API do Asaas. Se a API do Asaas não retornar o saldo, 
os valores serão zerados e a escola precisará consultar o saldo manualmente no painel do Asaas.

Requer persona SCHOOL.

---

### `POST` `/schools/finance/charges`

**Resumo:** Criar cobrança financeira para aluno

**Funcionalidade:**

Registra uma cobrança para um aluno ou dependente da escola, vinculando-a ao curso e opcionalmente à turma correspondente.

---

### `POST` `/schools/finance/charges/\{chargeId\}/mark-paid`

**Resumo:** Dar baixa em pagamento (marcar cobrança como paga)

**Funcionalidade:**

Permite à escola dar baixa manual em uma cobrança do aluno, marcando-a como paga.
A cobrança deve pertencer à escola do usuário autenticado.
Se a cobrança tiver PIX ou boleto no Asaas, o pagamento é marcado como recebido no Asaas (receiveInCash).
Payload: data (data do pagamento) e observacao (opcional).

---

### `GET` `/schools/finance/summary`

**Resumo:** Obter resumo financeiro da escola

**Funcionalidade:**

Retorna informações financeiras da escola, incluindo saques disponíveis (limite de 30), saldo disponível e total recebido no mês atual. Requer persona SCHOOL.

---

### `GET` `/schools/finance/withdrawals`

**Resumo:** Listar histórico de saques da escola

**Funcionalidade:**

Retorna o histórico de saques realizados pela escola, com opção de filtrar por mês e ano. Requer persona SCHOOL.

---

### `POST` `/schools/finance/withdrawals`

**Resumo:** Solicitar saque do saldo disponível

**Funcionalidade:**

Solicita um saque do valor disponível na conta Asaas da escola para uma conta bancária pessoal cadastrada.
O saque será processado usando a API key da conta Asaas da escola.
Requer persona SCHOOL e que a escola tenha conta Asaas configurada com API key.

---

### `GET` `/schools/images`

**Resumo:** Listar imagens da escola

**Funcionalidade:**

Retorna todas as imagens enviadas pela escola autenticada.
As URLs retornadas são assinadas e válidas por 1 hora.
Pode filtrar por categoria usando o parâmetro query `category`.

---

### `POST` `/schools/images`

**Resumo:** Enviar imagem da escola

**Funcionalidade:**

Faz upload de uma imagem para a escola autenticada. A imagem é armazenada no bucket configurado.
- Apenas um arquivo por vez
- Tipos aceitos: JPEG, JPG, PNG, WEBP, GIF
- Tamanho máximo: 5MB
- A imagem é armazenada na pasta `schools/\{schoolId\}/images/\{category\}/`
- Categorias disponíveis: GALLERY (padrão), LOGO, BANNER, COVER, OTHER

---

### `GET` `/schools/kyc/documents`

**Resumo:** Consultar documentos pendentes de KYC

**Funcionalidade:**

Retorna os documentos pendentes de KYC (Know Your Customer) da escola autenticada no Asaas.
Este endpoint busca os documentos diretamente da API do Asaas usando a API key da subconta da escola.

O sistema automaticamente extrai o `onboardingUrl` dos documentos pendentes e atualiza o registro
da escola se um novo link for encontrado. O link de onboarding permite que a escola complete
o processo de verificação de identidade e envie os documentos necessários.

**Nota:** Após a criação da subconta no Asaas, pode levar até 15 segundos para que os documentos
pendentes estejam disponíveis. Este endpoint retorna os documentos disponíveis no momento da consulta.

---

### `POST` `/schools/kyc/documents/\{documentGroupId\}/upload`

**Resumo:** Enviar documento de onboarding (KYC)

**Funcionalidade:**

Envia um documento para um grupo pendente de KYC da escola no Asaas (envio manual).
Use quando o link de onboarding não estiver disponível ou quando o cliente preferir enviar pelo app.
O `documentGroupId` e o `type` vêm da lista retornada em GET /schools/kyc/documents.
A escola só pode enviar documentos da própria conta. Requer autenticação com persona SCHOOL.
Tipos aceitos: IDENTIFICATION, IDENTIFICATION_SELFIE, MINUTES_OF_ELECTION, SOCIAL_CONTRACT, OTHER.
Arquivos: PDF ou imagem (JPEG/PNG), até 10MB.

---

### `POST` `/schools/kyc/sync-onboarding-documents`

**Resumo:** Sincronizar documentos de onboarding com o Asaas

**Funcionalidade:**

Sincroniza os documentos pendentes da escola com o Asaas e atualiza a `onboardingUrl` na escola
quando um novo link for disponibilizado. Use para forçar atualização da lista de documentos e
do link de onboarding (onboarding manual). Requer autenticação com persona SCHOOL.

---

### `POST` `/schools/login`

**Resumo:** Autenticar uma escola

**Funcionalidade:**

Autentica uma escola e retorna um token de acesso. A resposta inclui informações sobre o status do onboarding (KYC):
- `onboardingCompleted`: indica se o processo de onboarding foi finalizado (true quando a escola tem accountId e accountApiKey)
- `onboardingUrl`: link para completar o onboarding (retornado apenas quando onboardingCompleted é false)

---

### `GET` `/schools/me`

**Resumo:** Consultar dados completos da escola autenticada

**Funcionalidade:** ver detalhes e parâmetros no [Swagger](pathname:///docs) (tag correspondente).

---

### `PUT` `/schools/me`

**Resumo:** Atualizar dados da escola autenticada

**Funcionalidade:**

Permite que uma escola autenticada atualize seus próprios dados.

---

### `GET` `/schools/notifications`

**Resumo:** Listar notificações da escola

**Funcionalidade:**

Retorna todas as notificações relacionadas à escola autenticada. As notificações são ordenadas por data de envio (mais recentes primeiro). Suporta paginação através dos parâmetros limit e offset.

---

### `POST` `/schools/notifications/classes/\{classId\}/push`

**Resumo:** Enviar push notification para uma turma

**Funcionalidade:**

Cria uma notificação do tipo CLASS e enfileira um job de push (FCM) para todos os responsáveis/alunos matriculados ativamente na turma.

---

### `PATCH` `/schools/password`

**Resumo:** Alterar senha da escola logada

**Funcionalidade:**

Permite que uma escola autenticada altere sua própria senha

---

### `POST` `/schools/password/otp/request`

**Resumo:** Solicitar código no WhatsApp para reset de senha

**Funcionalidade:**

Envia código via Twilio Verify (WhatsApp) para o telefone da escola associado ao e-mail do proprietário. A rota `POST /schools/password/request` (só e-mail) foi descontinuada.

---

### `POST` `/schools/password/otp/verify`

**Resumo:** Validar código do WhatsApp

**Funcionalidade:**

Retorna `resetToken` para usar em `POST /schools/password/reset`.

---

### `POST` `/schools/password/reset`

**Resumo:** Resetar senha com token

**Funcionalidade:**

Redefine a senha da escola usando o `resetToken` obtido após `otp/verify`.

---

### `POST` `/schools/password/validate`

**Resumo:** Validar token de reset de senha

**Funcionalidade:**

Verifica se um token de reset de senha é válido e retorna informações sobre ele

---

### `GET` `/schools/payments`

**Resumo:** Listar pagamentos dos alunos da escola

**Funcionalidade:**

Retorna as cobranças financeiras de todos os alunos matriculados na escola, filtradas por mês e ano (obrigatório), com informações do aluno, dependente (quando existir), curso e turma.

---

### `GET` `/schools/payments/consolidated`

**Resumo:** Consolidado de pagamentos dos estudantes da escola

**Funcionalidade:**

Retorna os totais consolidados de mensalidades dos alunos da escola para um mês e ano específicos.
- `pending`, `paid` e `overdue` são quantidades (número de itens)
- `totalToReceive` e `totalReceived` são valores monetários em centavos
- `totalToReceive` inclui pendentes e vencidos

---

### `GET` `/schools/payments/paid`

**Resumo:** Listar pagamentos pagos dos alunos da escola

**Funcionalidade:**

Retorna apenas os pagamentos com status PAID de todos os alunos matriculados na escola.
Não requer filtro de mês e ano, permitindo buscar todos os pagamentos pagos.
Suporta paginação e filtro opcional por nome do aluno.

---

### `GET` `/schools/plan`

**Resumo:** Consultar plano ativo da escola

**Funcionalidade:**

Retorna o plano de assinatura vigente, status de pagamento e datas de cobrança.

---

### `POST` `/schools/plan`

**Resumo:** Selecionar plano para a escola

**Funcionalidade:**

Atualiza o plano de assinatura da escola autenticada e gera uma fatura PIX para pagamento imediato. A resposta inclui os dados do PIX (QR Code, código copia e cola, ID da transação e data de vencimento) para que o usuário possa pagar o plano escolhido na hora. A data de vencimento é o mesmo dia da seleção. O plano fica em estado pendente até que a fatura seja paga com sucesso.

---

### `GET` `/schools/plan/invoices`

**Resumo:** Listar faturas do plano

**Funcionalidade:**

Retorna todas as faturas associadas ao plano atual da escola, incluindo os status ABERTA, PAGA ou CANCELADA. Utilize esta listagem para checar cobranças pendentes antes de efetuar o pagamento.

---

### `POST` `/schools/plan/invoices`

**Resumo:** Gerar fatura do plano vigente

**Funcionalidade:**

Emite uma nova fatura para o plano ativo da escola. Caso já exista uma fatura para a mesma data de vencimento, ela é reutilizada. Use este endpoint apenas quando precisar gerar ou reenviar uma cobrança; para listar faturas existentes utilize o GET correspondente.
**Cupons de desconto:** Se um `couponCode` for fornecido e o cupom tiver `durationMonths > 1`, o sistema gerará automaticamente múltiplas faturas (uma para cada mês) até o limite da duração do cupom ou até a data de validade do cupom. Todas as faturas geradas terão o desconto aplicado.

---

### `GET` `/schools/plans`

**Resumo:** Listar planos disponíveis para escolas

**Funcionalidade:**

Retorna todos os planos de assinatura ativos que podem ser contratados pelas escolas.

---

### `GET` `/schools/sessions`

**Resumo:** Listar sessões de aula da escola

**Funcionalidade:** ver detalhes e parâmetros no [Swagger](pathname:///docs) (tag correspondente).

---

### `DELETE` `/schools/sessions/\{sessionId\}`

**Resumo:** Cancelar uma sessão de aula

**Funcionalidade:** ver detalhes e parâmetros no [Swagger](pathname:///docs) (tag correspondente).

---

### `GET` `/schools/students`

**Resumo:** Listar alunos matriculados na escola

**Funcionalidade:**

Retorna as matrículas ativas com os dados do aluno, dependente (quando existir), curso e turma.

---

### `GET` `/schools/students/directory/\{cpf\}`

**Resumo:** Buscar aluno ou dependente por CPF

**Funcionalidade:**

Permite que escolas localizem um aluno ou dependente pelo CPF. Quando o CPF pertence a um dependente, os dados do responsável são incluídos na resposta.

---

### `GET` `/schools/students/\{studentId\}`

**Resumo:** Obter detalhes completos de um aluno

**Funcionalidade:**

Retorna os detalhes completos de um aluno vinculado à escola, incluindo:
- Dados do aluno (nome, email, telefone, CPF, data de nascimento)
- Dados do responsável (se o aluno for um dependente)
- Lista de cursos e turmas em que está matriculado na escola
- Cobranças (pendentes e pagas) do aluno na escola (paidCharges)

**Importante:** A rota só retorna dados se o aluno estiver vinculado à escola através de matrículas ativas.

---

### `GET` `/schools/students/\{studentId\}/financial-summary`

**Resumo:** Consolidado financeiro do aluno na escola

**Funcionalidade:**

Retorna totais em centavos (valor líquido das cobranças) para o aluno ou dependente informado,
apenas se houver matrícula ativa na escola logada.

- `pendingTotalCents`: cobranças em aberto com vencimento ainda não ultrapassado (e falhas não vencidas).
- `overdueTotalCents`: status OVERDUE ou em aberto com data de vencimento já passada.
- `paidTotalCents`: cobranças pagas.
- `grandTotalCents`: soma de todas as cobranças do aluno na escola, **incluindo canceladas**.

---

