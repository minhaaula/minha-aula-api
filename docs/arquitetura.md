# Diagrama de Arquitetura - Payments API

## Visão Geral da Arquitetura

Este projeto segue os princípios da **Clean Architecture** (Arquitetura Hexagonal), organizando o código em camadas bem definidas com separação de responsabilidades.

## Diagrama de Camadas

```mermaid
graph TB
    subgraph "Camada de Apresentação"
        HTTP[HTTP/Express]
        Routes[Rotas]
        Middlewares[Middlewares]
        Swagger[Swagger/OpenAPI]
    end
    
    subgraph "Camada de Aplicação"
        UseCases[Casos de Uso]
        Presenters[Presenters]
        Contracts[Contratos]
    end
    
    subgraph "Camada de Domínio"
        Entities[Entidades]
        ValueObjects[Value Objects]
        Events[Eventos de Domínio]
    end
    
    subgraph "Camada de Infraestrutura"
        DB[(TypeORM/MySQL)]
        Repositories[Repositórios Adapters]
        Providers[Provedores Externos]
        Email[Email Service]
        Storage[S3 Storage]
        Messaging[BullMQ/Outbox]
    end
    
    subgraph "Portas/Interfaces"
        RepoPorts[Ports: Repositories]
        ProviderPorts[Ports: Providers]
    end
    
    HTTP --> Routes
    Routes --> Middlewares
    Routes --> UseCases
    UseCases --> Presenters
    UseCases --> RepoPorts
    UseCases --> ProviderPorts
    RepoPorts --> Repositories
    ProviderPorts --> Providers
    Repositories --> DB
    Providers --> Email
    Providers --> Storage
    Providers --> Messaging
    UseCases --> Entities
    Entities --> ValueObjects
    Entities --> Events
    Swagger --> HTTP
```

## Módulos da Aplicação

```mermaid
graph LR
    subgraph "Módulos Principais"
        Auth[Auth Module<br/>Autenticação]
        Admin[Admin Module<br/>Administração]
        Payments[Payments Module<br/>Pagamentos]
        Schools[Schools Module<br/>Escolas]
        Students[Students Module<br/>Estudantes]
    end
    
    Auth --> Schools
    Auth --> Students
    Auth --> Admin
    Payments --> Schools
    Payments --> Students
    Schools --> Students
    Admin --> Schools
    Admin --> Payments
```

## Fluxo de Requisição HTTP

```mermaid
sequenceDiagram
    participant Client
    participant Express
    participant Routes
    participant Middleware
    participant UseCase
    participant Repository
    participant Database
    participant Provider
    
    Client->>Express: HTTP Request
    Express->>Routes: Route Handler
    Routes->>Middleware: Auth/Validation
    Middleware->>UseCase: Execute
    UseCase->>Repository: Get Data
    Repository->>Database: Query
    Database-->>Repository: Result
    Repository-->>UseCase: Domain Entity
    UseCase->>Provider: External Service
    Provider-->>UseCase: Response
    UseCase->>UseCase: Business Logic
    UseCase->>Presenter: Format Output
    Presenter-->>Routes: Response DTO
    Routes-->>Express: JSON Response
    Express-->>Client: HTTP Response
```

## Estrutura de Diretórios

```mermaid
graph TD
    Root[payments-api/]
    
    Root --> Src[src/]
    Root --> Dist[dist/]
    Root --> Test[test/]
    Root --> Docs[docs/]
    
    Src --> App[app/<br/>Casos de Uso]
    Src --> Domain[domain/<br/>Entidades]
    Src --> Infra[infra/<br/>Infraestrutura]
    Src --> Ports[ports/<br/>Interfaces]
    Src --> Bootstrap[bootstrap/<br/>Configuração]
    Src --> Shared[shared/<br/>Compartilhado]
    Src --> Main[main.ts]
    
    App --> UseCases[use-cases/]
    App --> Presenters[presenters/]
    App --> Contracts[contracts/]
    App --> Types[types/]
    
    Domain --> Entities[entities/]
    Domain --> ValueObjects[value-objects/]
    Domain --> Events[events/]
    
    Infra --> HTTP[http/<br/>Express/Routes]
    Infra --> DB[db/<br/>TypeORM]
    Infra --> Providers[providers/<br/>Externos]
    Infra --> Auth[auth/<br/>JWT/Scrypt]
    Infra --> Email[email/<br/>Templates]
    Infra --> Messaging[messaging/<br/>BullMQ]
    Infra --> Cron[cron/<br/>Tarefas]
    
    Ports --> RepoPorts[repositories/]
    Ports --> ProviderPorts[providers/]
    
    Bootstrap --> Modules[modules/<br/>Auth, Admin, etc]
```

## Integrações Externas

```mermaid
graph TB
    subgraph "Payments API"
        App[Aplicação]
    end
    
    subgraph "Provedores de Pagamento"
        Asaas[Asaas<br/>Gateway de Pagamento<br/>- Subcontas<br/>- KYC/Onboarding<br/>- Cobranças]
    end
    
    subgraph "Provedores de Email"
        Mailchimp[Mailchimp]
        SendGrid[Twilio SendGrid]
        Nodemailer[Nodemailer]
    end
    
    subgraph "Armazenamento"
        S3[S3/Railway Storage]
    end
    
    subgraph "Banco de Dados"
        MySQL[(MySQL)]
    end
    
    subgraph "Fila de Mensagens"
        BullMQ[BullMQ/Redis]
    end
    
    App --> Asaas
    App --> Mailchimp
    App --> SendGrid
    App --> Nodemailer
    App --> S3
    App --> MySQL
    App --> BullMQ
```

## Integração com Asaas - KYC e Subcontas

### Criação de Subconta

Quando uma escola é criada, o sistema automaticamente:

1. **Cria uma subconta no Asaas** via `createSubAccount` (em geral após o primeiro pagamento do plano, via worker `EnsureSchoolAsaasAccount`)
   - Envia dados da escola (nome, email, documento fiscal, telefone, endereço, faturamento): **CNPJ** (PJ) ou **CPF do titular + data de nascimento** (PF, quando não há CNPJ — campos `ownerCpf` / `ownerBirthDate`), com `companyType` adequado (ex.: `INDIVIDUAL` para PF) e `birthDate` no Asaas quando aplicável
   - Recebe: `accountId`, `apiKey`, `walletId`

2. **Busca detalhes da conta** via `getAccount`
   - Pode retornar `onboardingUrl` se disponível

3. **Busca documentos pendentes** via `/myAccount/documents` (usando API key da subconta)
   - Aguarda 15 segundos após criação (tempo necessário para processamento)
   - Extrai `onboardingUrl` dos documentos pendentes
   - Atualiza a escola com o `onboardingUrl` encontrado

4. **Salva informações no banco**
   - `accountId`: ID da subconta no Asaas
   - `accountApiKey`: API key da subconta (para operações futuras)
   - `walletId`: ID da carteira digital
   - `onboardingUrl`: Link para completar o KYC

### Endpoints de KYC

- **GET /schools/kyc/documents**: Retorna documentos pendentes e `onboardingUrl`
  - Requer autenticação
  - Usa a API key da subconta para buscar documentos
  - Atualiza `onboardingUrl` se encontrado nos documentos

### Use Cases Relacionados

- **CreateSchool**: Cria escola e subconta no Asaas, retorna `kycUrl`
- **GetSchoolPendingDocuments**: Busca documentos pendentes e `onboardingUrl`
- **GetSchoolProfile**: Retorna perfil da escola incluindo `onboardingUrl`
- **HandleAsaasPaymentWebhook**: Garante que a subconta existe ao processar pagamentos

## Fluxo de Criação de Escola e KYC

```mermaid
sequenceDiagram
    participant Frontend
    participant API
    participant CreateSchool
    participant Asaas
    participant Database
    
    Frontend->>API: POST /schools (criar escola)
    API->>CreateSchool: Execute
    CreateSchool->>Database: Salvar escola
    CreateSchool->>Asaas: Criar subconta
    Asaas-->>CreateSchool: Subconta criada (apiKey, walletId)
    CreateSchool->>Asaas: Buscar detalhes da conta
    Asaas-->>CreateSchool: Detalhes (onboardingUrl)
    CreateSchool->>Database: Atualizar escola (accountId, accountApiKey, walletId, onboardingUrl)
    CreateSchool-->>API: Escola criada + kycUrl
    API-->>Frontend: Response com link de KYC
    
    Note over Frontend: Usuário acessa link de onboarding
    Frontend->>API: GET /schools/kyc/documents
    API->>GetSchoolPendingDocuments: Execute
    GetSchoolPendingDocuments->>Asaas: Buscar documentos pendentes
    Asaas-->>GetSchoolPendingDocuments: Documentos + onboardingUrl
    GetSchoolPendingDocuments->>Database: Atualizar onboardingUrl se necessário
    GetSchoolPendingDocuments-->>API: Documentos pendentes + onboardingUrl
    API-->>Frontend: Lista de documentos + link
```

## Fluxo de Pagamento

```mermaid
sequenceDiagram
    participant School
    participant API
    participant UseCase
    participant Asaas
    participant Webhook
    participant Email
    
    School->>API: Criar Fatura
    API->>UseCase: Issue School Plan Invoice
    UseCase->>Asaas: Criar Cobrança
    Asaas-->>UseCase: Boleto/PIX
    UseCase->>Email: Enviar Notificação
    UseCase-->>API: Invoice Criada
    API-->>School: Response
    
    Note over Asaas: Pagamento Processado
    Asaas->>Webhook: Notificação
    Webhook->>UseCase: Handle Webhook
    UseCase->>UseCase: Atualizar Status
    UseCase->>Email: Confirmação
```

## Entidades Principais do Domínio

```mermaid
erDiagram
    School ||--o{ SchoolPlanInvoice : tem
    School ||--o{ Course : oferece
    School ||--o{ SchoolBankAccount : possui
    School ||--o{ SchoolFinancialCharge : gera
    School }o--|| Asaas : possui_subconta
    
    Course ||--o{ CourseClass : contém
    CourseClass ||--o{ ClassSession : possui
    
    User ||--o{ Dependent : tem
    User ||--o{ Enrollment : possui
    
    Dependent ||--o{ EnrollmentRequest : solicita
    EnrollmentRequest }o--|| CourseClass : para
    
    SchoolPlanInvoice ||--o| Payment : gera
    Payment }o--|| Asaas : processado_por
    
    SchoolPlanInvoice }o--o| DiscountCoupon : pode_usar
    
    School {
        string id
        string name
        string email
        string cnpj
        string accountId
        string accountApiKey
        string walletId
        string onboardingUrl
    }
```

No modelo persistido, `cnpj` pode ser **null** quando a escola opera como **pessoa física** (sem CNPJ). Nesse caso o cadastro público exige **`ownerBirthDate`** (YYYY-MM-DD) para integração com a subconta Asaas.

### Níveis, promoções, certificados e timeline por matrícula

O banco inclui tabelas opcionais ligadas à **matrícula** (catálogo de níveis por escola, histórico de promoções, certificados emitidos por promoção, templates de certificado e eventos de timeline). Não existe nível “global do aluno”: o estado vigente e o histórico referem-se sempre a `enrollment_id`. Detalhes, diagrama e políticas de FK: [modelo-niveis-certificados-timeline-matricula.md](./modelo-niveis-certificados-timeline-matricula.md).

## Módulos e Rotas

```mermaid
graph TB
    subgraph "Auth Module"
        A1[POST /auth/login]
        A2[POST /auth/refresh]
        A3[POST /auth/reset-password]
    end
    
    subgraph "Schools Module"
        S1[GET /schools/profile]
        S2[POST /schools/plans]
        S3[GET /schools/payments]
        S4[POST /schools/images]
        S5[GET /schools/kyc/documents]
        S6[GET /schools/dashboard]
        S7[POST /schools/finance/withdrawal]
    end
    
    subgraph "Students Module"
        ST1[GET /students/...]
        ST2[POST /students/...]
    end
    
    subgraph "Payments Module"
        P1[GET /payments/...]
        P2[POST /payments/...]
    end
    
    subgraph "Admin Module"
        AD1[GET /admin/coupons]
        AD2[POST /admin/coupons]
    end
    
    subgraph "Webhooks"
        W1[POST /integrations/asaas/webhook]
    end
```

## Padrões de Design Utilizados

- **Repository Pattern**: Abstração de acesso a dados
- **Adapter Pattern**: Adaptadores para provedores externos
- **Use Case Pattern**: Casos de uso isolados
- **Dependency Injection**: Injeção de dependências via construtores
- **Outbox Pattern**: Para mensagens assíncronas
- **Module Pattern**: Módulos independentes e configuráveis
- **Provider Pattern**: Abstração de serviços externos (Asaas, Email, Storage)

## Casos de Uso Principais

### Módulo de Escolas

- **CreateSchool**: Cria uma nova escola e subconta no Asaas
  - Valida dados de entrada
  - Cria subconta no Asaas
  - Busca `onboardingUrl` para KYC
  - Salva escola no banco com dados do Asaas
  - Retorna `kycUrl` para o frontend

- **GetSchoolProfile**: Retorna perfil completo da escola
  - Inclui dados básicos, endereços, contas bancárias, imagens
  - Inclui `onboardingUrl` para KYC
  - Calcula status de inadimplência

- **GetSchoolPendingDocuments**: Busca documentos pendentes de KYC
  - Usa API key da subconta para buscar documentos
  - Extrai `onboardingUrl` dos documentos
  - Atualiza escola se encontrar novo `onboardingUrl`

- **UpdateSchool**: Atualiza dados da escola
- **HandleAsaasPaymentWebhook**: Processa webhooks do Asaas
  - Garante que subconta existe antes de processar pagamento

## Tecnologias Principais

- **Runtime**: Node.js
- **Framework**: Express.js
- **ORM**: TypeORM
- **Database**: MySQL
- **Autenticação**: JWT (HMAC)
- **Validação**: Zod
- **Documentação**: Swagger/OpenAPI
- **Fila de Mensagens**: BullMQ
- **Storage**: AWS S3 / Railway Storage
- **Email**: Mailchimp / SendGrid / Nodemailer
- **Testes**: Vitest
- **Gateway de Pagamento**: Asaas (subcontas, KYC, cobranças)

## Scripts de Teste

O projeto inclui scripts para testar funcionalidades específicas:

- **test:kyc**: Testa o fluxo completo de KYC do Asaas
  - Cria subconta diretamente no Asaas
  - Aguarda processamento (15s)
  - Busca documentos pendentes
  - Extrai e exibe `onboardingUrl`

- **test:create-school**: Testa criação de escola via API
  - Cria escola via POST /schools
  - Verifica criação de subconta
  - Valida salvamento de dados (accountId, apiKey, walletId, onboardingUrl)
  - Testa rota de documentos pendentes

## Estrutura de Dados - School Entity

A entidade `School` inclui campos relacionados ao Asaas:

- `accountId`: ID da subconta no Asaas
- `accountApiKey`: API key da subconta (para operações autenticadas)
- `walletId`: ID da carteira digital no Asaas
- `onboardingUrl`: Link para completar o processo de KYC/onboarding

Esses campos são preenchidos automaticamente durante a criação da escola e podem ser atualizados quando documentos pendentes são verificados.

