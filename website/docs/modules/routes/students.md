---
sidebar_position: 5
title: Students (rotas)
---

# Students — rotas

App do **aluno / responsável** (**persona STUDENT**): perfil, cursos, pagamentos, pedidos de matrícula, escolas públicas, avaliações, notificações e push.

> Referência técnica completa: [Swagger UI](pathname:///docs) · [OpenAPI JSON](pathname:///docs/openapi.json)

## Endpoints (24)

### `GET` `/students`

**Resumo:** Listar alunos com dependentes

**Funcionalidade:**

Requer persona ADMIN ou SCHOOL. Quando autenticado como escola, cada aluno inclui o objeto `schoolContext` com as turmas, cursos e categorias vinculados na instituição.

---

### `POST` `/students/charges/\{chargeId\}/payments/pix`

**Resumo:** Gerar PIX para mensalidade

**Funcionalidade:**

Gera um pagamento PIX na Asaas para uma mensalidade específica. 
Se a mensalidade já tiver um PIX gerado, retorna os dados do PIX existente.

**Importante:** O PIX é gerado usando a conta Asaas da escola (subconta) quando disponível.
O sistema verifica automaticamente se a escola possui `accountId` e `accountApiKey` salvos.
Se a escola tiver uma subconta configurada na Asaas, o PIX será criado na conta da escola.
Caso contrário, será usado o provider principal da Asaas.

Requer persona STUDENT e a mensalidade deve pertencer ao estudante autenticado.

**Status permitidos para geração de PIX:**
- PENDING_SYNC
- FAILED
- OPEN
- OVERDUE

---

### `GET` `/students/courses`

**Resumo:** Listar meus cursos

**Funcionalidade:**

Retorna os cursos das matrículas ativas do usuário e dos dependentes (**ativos e inativos** na escola), com curso, escola, aluno, categoria, subcategoria, cidade, horários da turma e o campo **`active`** (`true` se o curso está ativo na escola, `false` se foi desativado). Requer persona STUDENT.

---

### `GET` `/students/courses/all`

**Resumo:** Listar todos os cursos cadastrados no sistema

**Funcionalidade:**

Retorna todos os cursos ativos cadastrados no sistema, com informações do curso, escola (logo, **capa** — categoria COVER, cidade e estado), categoria, subcategoria, média de avaliação da escola (1 a 5, quando houver) e quantidade total de avaliações da escola. Permite filtrar por nome do curso, categoria, subcategoria e cidade da escola. Esta rota é pública e não requer autenticação.

---

### `GET` `/students/directory/\{cpf\}`

**Resumo:** Listar alunos para convites

**Funcionalidade:**

Permite ADMIN ou SCHOOL localizarem um aluno ou dependente pelo CPF. Quando o CPF pertence a um dependente, os dados do responsável são incluídos na resposta.

---

### `GET` `/students/enrollment-requests`

**Resumo:** Listar meus pedidos de matrícula em aberto

**Funcionalidade:**

Retorna apenas pedidos de matrícula **EM ABERTO** (status PENDING) do estudante logado e dos seus dependentes.
Inclui valor da mensalidade, desconto (quando houver), turma, horários, nome e logo da escola.
Requer persona STUDENT.

---

### `POST` `/students/enrollment-requests/\{requestId\}/accept`

**Resumo:** Aceitar pedido de matrícula

**Funcionalidade:**

Permite ao estudante aceitar um pedido de matrícula pendente criado para ele ou para um dependente. Ao aceitar, a matrícula é criada e cobranças são geradas quando aplicável (equivalente a `POST /enrollment-requests/\{requestId\}/approve`).

**Notificações:** email de confirmação de matrícula (fila) e notificação in-app (`metadata.kind` = `ENROLLMENT_CONFIRMED`). Requer persona STUDENT; o pedido deve pertencer ao usuário autenticado.

---

### `POST` `/students/enrollment-requests/\{requestId\}/reject`

**Resumo:** Rejeitar pedido de matrícula

**Funcionalidade:**

Permite ao estudante rejeitar um pedido de matrícula pendente criado para ele ou para um dependente. O status passa a REJECTED e nenhuma matrícula é criada.

**Notificações:** email informando a recusa (fila) e notificação in-app (`metadata.kind` = `ENROLLMENT_REQUEST_REJECTED`). Requer persona STUDENT e o pedido deve pertencer ao estudante autenticado.

---

### `GET` `/students/enrollments/\{enrollmentId\}/timeline`

**Resumo:** Timeline agregada da matrícula (aluno/responsável)

**Funcionalidade:**

Retorna a linha do tempo da matrícula no app dos pais: matrícula, promoções de nível,
certificados emitidos e marcos customizados da escola, em ordem cronológica.

**Visibilidade do aluno:** histórico **completo**, inclusive após desmatrícula (`CANCELLED` ou `COMPLETED`).
A escola, na rota homônoma sob `/schools/...`, vê apenas o período em que a matrícula esteve ativa.

Requer persona **STUDENT** e que a matrícula pertença ao usuário autenticado (`owner_user_id`).

Paginação: `limit` (1–100, padrão 30), `offset`, `order` (`asc` | `desc`, padrão `asc`).

---

### `GET` `/students/me`

**Resumo:** Obter dados do estudante logado

**Funcionalidade:**

Retorna os dados completos do estudante autenticado, incluindo informações pessoais e lista de dependentes. Requer persona STUDENT.

---

### `PUT` `/students/me`

**Resumo:** Editar dados do estudante logado

**Funcionalidade:**

Permite atualizar os dados pessoais do estudante autenticado. Todos os campos são opcionais - apenas os campos enviados serão atualizados. Requer persona STUDENT.

---

### `POST` `/students/me/profile-photo`

**Resumo:** Enviar ou atualizar foto de perfil do aluno

**Funcionalidade:**

Faz upload da foto de perfil do estudante autenticado (substitui a anterior, se existir).
Aceita apenas **JPG** e **PNG** (máx. 5MB). Campo multipart `image`.
Retorna URL assinada acessível publicamente (validade de 7 dias). Requer persona **STUDENT**.

---

### `DELETE` `/students/me/profile-photo`

**Resumo:** Remover foto de perfil do aluno

**Funcionalidade:**

Remove a foto do storage e zera `photoUrl` no perfil. Requer persona **STUDENT**.

---

### `GET` `/students/notifications`

**Resumo:** Listar notificações do aluno

**Funcionalidade:**

Retorna notificações do aluno autenticado (incluindo `scope` USER para o “sino” do app: boas-vindas, pedidos de matrícula, confirmação/recusa, lembretes de mensalidade, além de notificações de turma quando existirem). Itens incluem `title`, `message`, `metadata` (ex.: `kind`, ids de pedido/cobrança) e `readAt`. Ordenação: data de envio, mais recentes primeiro. Paginação: `limit` e `offset`. Requer persona STUDENT.

---

### `PUT` `/students/notifications/read-all`

**Resumo:** Marcar todas as notificações como lidas

**Funcionalidade:**

Marca todas as notificações não lidas do aluno autenticado como lidas de uma vez. Retorna o número de notificações que foram marcadas como lidas. Requer persona STUDENT.

---

### `PUT` `/students/notifications/\{notificationId\}/read`

**Resumo:** Marcar uma notificação como lida

**Funcionalidade:**

Marca uma notificação do aluno autenticado como lida (in-app). Só aplica a notificações cujo `userId` é o próprio aluno (ex.: `scope` USER). Se já estiver lida, retorna o mesmo `readAt` (idempotente). Se o ID não existir ou não pertencer ao aluno, retorna 404. Requer persona STUDENT.

---

### `GET` `/students/payments`

**Resumo:** Listar pagamentos do estudante

**Funcionalidade:**

Retorna os pagamentos (cobranças financeiras) do usuário logado e seus dependentes. Inclui tipo da transação (mensalidade/matrícula), campo `description` para exibição (ex.: "Mensalidade de Fevereiro de 2026"), data de pagamento, desconto, valor líquido, logo da escola e observação quando for pagamento manual. Requer persona STUDENT.

---

### `GET` `/students/payments/\{paymentId\}`

**Resumo:** Obter detalhes de um pagamento específico

**Funcionalidade:**

Retorna os detalhes completos de um pagamento específico realizado pelo estudante.
Inclui informações sobre data, valor, tipo de pagamento (PIX, boleto ou manual),
chave PIX (quando aplicável), banco de origem, nome do estudante, curso, etc.
Requer persona STUDENT e o pagamento deve pertencer ao estudante autenticado.

---

### `POST` `/students/push-tokens`

**Resumo:** Registrar token de Push (FCM)

**Funcionalidade:**

Registra ou atualiza o token FCM do dispositivo para receber push (ex.: novo pedido de matrícula pela escola, lembrete de mensalidade a vencer), além das notificações in-app listadas em GET /students/notifications. Requer persona STUDENT e integração Firebase/worker ativas no ambiente.

---

### `DELETE` `/students/push-tokens`

**Resumo:** Remover token de Push (FCM)

**Funcionalidade:**

Revoga o token FCM do dispositivo (ex: logout). Requer persona STUDENT.

---

### `GET` `/students/schools/\{schoolId\}`

**Resumo:** Obter detalhes de uma escola

**Funcionalidade:**

Retorna os dados públicos de uma escola específica, incluindo nome, contato, endereços, links das redes sociais e imagens. 

Esta rota é pública e não requer autenticação. No entanto, se o usuário estiver autenticado, o campo `canReview` será calculado 
indicando se o aluno pode avaliar a escola (true apenas se estiver matriculado na escola ou algum dependente, e ainda não tiver realizado avaliação).

---

### `GET` `/students/schools/\{schoolId\}/courses`

**Resumo:** Listar cursos de uma escola

**Funcionalidade:**

Retorna todos os cursos ativos de uma escola específica, incluindo nome do curso, descrição, categoria e subcategorias. Esta rota é pública e não requer autenticação.

---

### `GET` `/students/schools/\{schoolId\}/reviews`

**Resumo:** Listar avaliações de uma escola

**Funcionalidade:**

Retorna as avaliações de uma escola específica com paginação. Inclui nome do aluno, foto, nota (1 a 5) e descrição. Esta rota é pública e não requer autenticação.

---

### `POST` `/students/schools/\{schoolId\}/reviews`

**Resumo:** Avaliar escola

**Funcionalidade:**

Permite ao aluno autenticado avaliar uma escola. 

**Requisitos:**
- O aluno ou algum de seus dependentes deve estar matriculado na escola
- O aluno não pode ter avaliado a mesma escola anteriormente

**Validações:**
- A nota (rating) deve ser um número inteiro entre 1 e 5
- A descrição é opcional e pode ter no máximo 1000 caracteres

Requer persona STUDENT.

---

