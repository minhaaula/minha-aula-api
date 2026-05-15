---
sidebar_position: 4
title: Schools (rotas)
---

# Schools — rotas

Gestão da **escola** autenticada (**persona SCHOOL**): perfil, cursos, turmas, alunos, financeiro, plano, notificações, contas bancárias, imagens e KYC.

> Referência técnica completa: [Swagger UI](pathname:///docs) · [OpenAPI JSON](pathname:///docs/openapi.json)

## Endpoints (80)

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
Requer um OTP previamente validado em `/schools/security/otp/verify` para a finalidade `BANK_ACCOUNT_CHANGE`.

---

### `PUT` `/schools/bank-accounts/\{accountId\}`

**Resumo:** Atualizar uma conta bancária

**Funcionalidade:**

Atualiza os dados de uma conta bancária existente da escola autenticada.
Requer um OTP previamente validado em `/schools/security/otp/verify` para a finalidade `BANK_ACCOUNT_CHANGE`.

---

### `DELETE` `/schools/bank-accounts/\{accountId\}`

**Resumo:** Deletar uma conta bancária

**Funcionalidade:**

Remove uma conta bancária da escola autenticada.
Requer um OTP previamente validado em `/schools/security/otp/verify` para a finalidade `BANK_ACCOUNT_CHANGE`.

---

### `GET` `/schools/categories`

**Resumo:** Listar categorias e subcategorias disponíveis

**Funcionalidade:**

Retorna as categorias de cursos e suas respectivas subcategorias para auxiliar na criação de cursos.

---

### `GET` `/schools/certificate-templates`

**Resumo:** Listar templates de certificado da escola

**Funcionalidade:**

Retorna os modelos de certificado configurados para a escola (`logicalTemplateId` único por escola).
Requer persona **SCHOOL**.

---

### `POST` `/schools/certificate-templates`

**Resumo:** Criar template de certificado

**Funcionalidade:**

Cadastra um modelo de certificado. `layoutConfig` é JSON livre para evolução de layout sem alterar schema.

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

### `DELETE` `/schools/courses/\{courseId\}/classes/\{classId\}/enrollments/\{enrollmentId\}`

**Resumo:** Desmatricular aluno da turma

**Funcionalidade:**

Cancela a matrícula (status `CANCELLED`). As cobranças financeiras existentes
(boletos, PIX, mensalidades abertas ou atrasadas) **não são removidas nem alteradas**.

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

### `GET` `/schools/enrollments/\{enrollmentId\}/progress`

**Resumo:** Visão de progresso da matrícula

**Funcionalidade:**

Retorna nível atual, histórico de promoções e eventos de timeline da matrícula na escola autenticada.
O nível é **por matrícula**, não global ao aluno. Use `timelineLimit` para limitar eventos (padrão 50, máx. 200).

---

### `POST` `/schools/enrollments/\{enrollmentId\}/promotions`

**Resumo:** Registrar promoção de nível na matrícula

**Funcionalidade:**

Registra uma promoção e atualiza o nível atual da matrícula (`currentSchoolStudentLevelId`).
`toLevelId` é obrigatório. Se `fromLevelId` for omitido, a origem é o nível atual da matrícula (ou vazio na primeira promoção).
Snapshots de rótulo e ordem são gravados no histórico.

---

### `POST` `/schools/enrollments/\{enrollmentId\}/promotions/\{promotionId\}/certificates`

**Resumo:** Registrar certificado emitido para uma promoção

**Funcionalidade:**

Associa um certificado a uma promoção já registrada. **No máximo um** certificado por promoção.
`documentUrl` pode ser `null` até o arquivo estar disponível.

---

### `GET` `/schools/enrollments/\{enrollmentId\}/timeline`

**Resumo:** Timeline agregada da matrícula (escola)

**Funcionalidade:**

Retorna eventos da matrícula em ordem cronológica, agregando matrícula, promoções de nível,
certificados e marcos customizados (`enrollment_timeline_events`).

**Visibilidade da escola:** apenas eventos entre `enrolledAt` e o encerramento da matrícula
(`updatedAt` quando status `CANCELLED` ou `COMPLETED`). Eventos fora desse intervalo não são retornados.

Paginação via `limit` (1–100, padrão 30), `offset` e `order` (`asc` ou `desc`, padrão `asc`).

---

### `POST` `/schools/enrollments/\{enrollmentId\}/timeline-events`

**Resumo:** Adicionar marco customizado na timeline da matrícula

**Funcionalidade:**

Insere um marco customizado em `enrollment_timeline_events`. O `eventType` padrão é `CUSTOM_MILESTONE`
(subtipos opcionais podem ir em `payload`). `occurredAt` é opcional (ISO-8601); se omitido, usa a hora do servidor.

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

### `POST` `/schools/finance/charges/\{chargeId\}/pix`

**Resumo:** Gerar PIX para cobrança (mensalidade/matrícula)

**Funcionalidade:**

Gera o PIX (Asaas) sob demanda para uma cobrança da escola (tipos permitidos: TUITION e ENROLLMENT).
Se o PIX já tiver sido gerado anteriormente, retorna o PIX já existente.

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
Requer persona SCHOOL, que a escola tenha conta Asaas configurada com API key e um OTP previamente validado
em `/schools/security/otp/verify` para a finalidade `WITHDRAWAL`.

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

### `GET` `/schools/kyc/asaas-account-status`

**Resumo:** Consultar situação cadastral (KYC) da subconta no Asaas

**Funcionalidade:**

Consulta diretamente o status cadastral da subconta da escola no Asaas (GET /v3/myAccount/status),
retornando os status por etapa:
- `commercialInfo`
- `bankAccountInfo`
- `documentation`
- `general`

Quando todas as etapas estiverem `APPROVED`, a API marca `onboardingCompletedAt` no cadastro da escola.

---

### `POST` `/schools/kyc/bank-account/resend`

**Resumo:** Reenviar dados bancários para o Asaas (KYC)

**Funcionalidade:**

Reenvia/sincroniza os dados bancários da escola para o Asaas no contexto da subconta autenticada.
Use quando `bankAccountInfo` estiver `REJECTED`/`PENDING` e a escola precisar reenviar após corrigir os dados.

**Requer OTP** (purpose `BANK_ACCOUNT_CHANGE`).

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

### `POST` `/schools/kyc/resend`

**Resumo:** Reenviar (sincronizar) KYC após reprovação/pendência

**Funcionalidade:**

Endpoint para o frontend “reprocessar” o KYC quando houver reprovação/pendência no Asaas.

Ele executa:
- sincronização de documentos pendentes + `onboardingUrl` (quando disponível)
- consulta do status cadastral (commercialInfo, bankAccountInfo, documentation, general)

Requer autenticação com persona SCHOOL.

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

### `GET` `/schools/notifications/preferences`

**Resumo:** Obter preferências de notificação da escola

**Funcionalidade:**

Retorna as preferências globais de notificação da escola autenticada (toggles por canal).
Requer autenticação com persona SCHOOL e contexto de escola resolvido.

---

### `PUT` `/schools/notifications/preferences`

**Resumo:** Atualizar preferências de notificação da escola

**Funcionalidade:**

Atualiza (parcialmente) as preferências globais de notificação da escola autenticada.
Quando um canal é desabilitado, o backend deixa de enfileirar envios daquele canal
para eventos associados à escola (inclui notificações enviadas pela escola para alunos).

---

### `PUT` `/schools/notifications/read-all`

**Resumo:** Marcar todas as notificações como lidas

**Funcionalidade:**

Marca todas as notificações não lidas da escola autenticada como lidas de uma vez (in-app). Aplica a notificações cujo `schoolId` é o da escola no token/contexto (inclui `scope` SCHOOL e CLASS). Retorna o número de notificações que foram marcadas como lidas.

---

### `PUT` `/schools/notifications/\{notificationId\}/read`

**Resumo:** Marcar uma notificação como lida

**Funcionalidade:**

Marca uma notificação da escola autenticada como lida (in-app). Aplica a notificações cujo `schoolId` é o da escola no token/contexto (inclui `scope` SCHOOL e CLASS). Se já estiver lida, retorna o mesmo `readAt` (idempotente). Se o ID não existir ou não pertencer à escola, retorna 404.

---

### `PATCH` `/schools/password`

**Resumo:** Alterar senha da escola logada

**Funcionalidade:**

Permite que uma escola autenticada altere sua própria senha

---

### `POST` `/schools/password/otp/request`

**Resumo:** Solicitar código no WhatsApp para reset de senha

**Funcionalidade:**

Inicia verificação por **Twilio Verify** (WhatsApp) para o telefone da escola associado ao e-mail do proprietário.
Em seguida use `POST /schools/password/otp/verify` e, com o `resetToken`, `POST /schools/password/reset`.
A rota antiga `POST /schools/password/request` (envio só por e-mail) foi descontinuada.

---

### `POST` `/schools/password/otp/verify`

**Resumo:** Validar código do WhatsApp (reset de senha da escola)

**Funcionalidade:**

Retorna `resetToken` para usar em `POST /schools/password/reset`.

---

### `POST` `/schools/password/reset`

**Resumo:** Resetar senha com token

**Funcionalidade:**

Redefine a senha da escola usando o `resetToken` retornado por `POST /schools/password/otp/verify`
(fluxo com código no WhatsApp).

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

Retorna apenas os pagamentos com status PAID de todos os alunos matriculados na escola,
excluindo pagamentos dados como baixa manual pela escola (marcados como MANUAL).
Inclui cobranças com método PIX ou BOLETO e registros antigos vinculados ao Asaas (asaasPaymentId).
Não requer filtro de mês e ano, permitindo buscar todos os pagamentos pagos elegíveis.
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

### `POST` `/schools/plan/invoices/\{invoiceId\}/pix`

**Resumo:** Obter/gerar PIX de uma fatura do plano (por invoiceId)

**Funcionalidade:**

Retorna `pixQrCode` e `pixCopiaECola` para uma fatura do plano da escola (informada por `invoiceId`).
Se a fatura ainda não tiver PIX persistido, o backend consulta o Asaas via `providerRef` e salva o PIX na invoice.

---

### `GET` `/schools/plans`

**Resumo:** Listar planos disponíveis para escolas

**Funcionalidade:**

Retorna todos os planos de assinatura ativos que podem ser contratados pelas escolas.

---

### `POST` `/schools/security/otp/request`

**Resumo:** Solicitar OTP para ação sensível da escola

**Funcionalidade:**

Gera e envia um código OTP via WhatsApp para o telefone cadastrado da escola.
Esse código deve ser validado antes de operações sensíveis, como saque e alteração de conta bancária.

---

### `POST` `/schools/security/otp/verify`

**Resumo:** Validar OTP para ação sensível da escola

**Funcionalidade:**

Valida o código OTP recebido via WhatsApp e habilita o uso do `challengeId`
em uma única operação sensível compatível com a finalidade do desafio.

---

### `GET` `/schools/sessions`

**Resumo:** Listar sessões de aula da escola

**Funcionalidade:** ver detalhes e parâmetros no [Swagger](pathname:///docs) (tag correspondente).

---

### `DELETE` `/schools/sessions/\{sessionId\}`

**Resumo:** Cancelar uma sessão de aula

**Funcionalidade:** ver detalhes e parâmetros no [Swagger](pathname:///docs) (tag correspondente).

---

### `GET` `/schools/student-levels`

**Resumo:** Listar níveis (faixas/graus) da escola

**Funcionalidade:**

Retorna o catálogo de níveis configurados para a escola autenticada, ordenados por `sortOrder`.
Usado para promoções de matrícula e certificados. Requer persona **SCHOOL** (contexto da escola no JWT).

---

### `POST` `/schools/student-levels`

**Resumo:** Criar nível da escola

**Funcionalidade:**

Cadastra um nível no catálogo da escola. `sortOrder` deve ser **único por escola**;
`templateCode` é opcional e também único por escola quando informado.

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

As cobranças (pendentes e pagas) estão em `GET /schools/students/\{studentId\}/paid-charges` (paginado)

**Importante:** A rota só retorna dados se o aluno estiver vinculado à escola através de matrículas ativas.

Na listagem (`GET /schools/students`), use o campo **`detailsStudentId`** no path desta rota para abrir a ficha do aluno matriculado (para matrícula de dependente, é o UUID do dependente; `student.id` na listagem é sempre o titular).

Alternativa: `studentId` = UUID do responsável e query **`dependentId`** = UUID do dependente (mesmo efeito que usar só o UUID do dependente em `studentId`).

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

### `GET` `/schools/students/\{studentId\}/paid-charges`

**Resumo:** Listar cobranças do aluno na escola (paginado)

**Funcionalidade:**

Retorna as cobranças financeiras do aluno na escola (pendentes e pagas), com paginação.
Cobranças canceladas não são incluídas. Ordenação: data de pagamento (mais recentes primeiro), depois vencimento.

Use os mesmos `studentId` e `dependentId` que em `GET /schools/students/\{studentId\}` (ficha do aluno).

---

