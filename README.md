# Payments API

API RESTful para gerenciamento de pagamentos, escolas, estudantes e matrículas, construída com TypeScript seguindo os princípios de Clean Architecture (Arquitetura Hexagonal).

## 🚀 Tecnologias

### Core
- **Node.js 20+** - Runtime JavaScript
- **TypeScript 5.5+** - Linguagem de programação
- **Express 4.x** - Framework web
- **TypeORM 0.3** - ORM para banco de dados
- **MySQL 8+** - Banco de dados relacional

### Integrações
- **Asaas** - Gateway de pagamentos (PIX, Boleto, Subcontas, KYC)
- **BullMQ 5.7** - Sistema de filas baseado em Redis
- **Redis** - Armazenamento em memória para filas
- **Firebase Cloud Messaging (FCM)** - Push notifications
- **AWS S3 / Railway Storage** - Armazenamento de arquivos

### Email Providers (Prioridade)
1. **Mailchimp** - Provedor principal
2. **Twilio SendGrid** - Fallback
3. **Nodemailer** - Fallback local

### Ferramentas
- **Vitest** - Framework de testes
- **Swagger/OpenAPI** - Documentação da API
- **Zod** - Validação de schemas
- **Docker** - Containerização

## 📐 Arquitetura

O projeto segue os princípios da **Clean Architecture (Arquitetura Hexagonal)**, organizando o código em camadas bem definidas:

```
┌─────────────────────────────────────┐
│   Camada de Apresentação            │
│   (HTTP/Express, Routes, Swagger)   │
└──────────────┬──────────────────────┘
               │
┌──────────────▼──────────────────────┐
│   Camada de Aplicação               │
│   (Use Cases, Presenters)           │
└──────────────┬──────────────────────┘
               │
┌──────────────▼──────────────────────┐
│   Camada de Domínio                 │
│   (Entities, Value Objects)         │
└──────────────┬──────────────────────┘
               │
┌──────────────▼──────────────────────┐
│   Camada de Infraestrutura          │
│   (TypeORM, Providers, BullMQ)      │
└─────────────────────────────────────┘
```

### Módulos da Aplicação

A aplicação é modular e pode ser executada com diferentes módulos ativos:

- **auth** - Autenticação e autorização
- **admin** - Operações administrativas
- **payments** - Processamento de pagamentos
- **schools** - Gestão de escolas, cursos e turmas
- **students** - Gestão de estudantes e matrículas

## 📋 Pré-requisitos

- Node.js 20+
- MySQL 8+
- Redis (para filas e jobs)
- Conta no Asaas (para pagamentos)
- Conta Firebase (para push notifications - opcional)

## 🔧 Instalação

```bash
# Clonar o repositório
git clone <repository-url>
cd payments-api

# Instalar dependências
npm install

# Copiar arquivo de ambiente
cp .env.example .env

# Configurar variáveis de ambiente (ver seção abaixo)
```

## ⚙️ Configuração

### Variáveis de Ambiente

Crie um arquivo `.env` na raiz do projeto com as seguintes variáveis:

#### Banco de Dados
```env
DB_HOST=localhost
DB_PORT=3306
DB_USER=payments
DB_PASS=payments
DB_NAME=payments
```

#### Autenticação
```env
# OBRIGATÓRIO - mínimo 32 caracteres para segurança adequada
AUTH_TOKEN_SECRET=your-super-secret-key-minimum-32-characters-long-for-security
AUTH_TOKEN_TTL=3600
```

#### CORS (Segurança)
```env
# Configuração de origem permitida (separar múltiplas origens por vírgula)
# Use '*' para permitir todas as origens (não recomendado em produção)
CORS_ORIGIN=*
# Exemplo para múltiplas origens: CORS_ORIGIN=https://app1.com,https://app2.com
```

#### Asaas (Pagamentos)
```env
ASAAS_API_KEY=your_asaas_token_here
ASAAS_BASE_URL=https://www.asaas.com/api/v3

# Webhooks (Opcional mas recomendado em produção)
# Token para validar requisições de webhook do Asaas
ASAAS_WEBHOOK_TOKEN=your-webhook-token-here

# Webhooks de Subcontas (Opcional)
ASAAS_SUBACCOUNT_WEBHOOK_URL=https://your-api.com/integrations/asaas
ASAAS_SUBACCOUNT_WEBHOOK_EMAIL=webhooks@your-domain.com
ASAAS_SUBACCOUNT_WEBHOOK_AUTH_TOKEN=subaccount-webhook-token
ASAAS_SUBACCOUNT_WEBHOOK_SEND_TYPE=SEQUENTIALLY
ASAAS_SUBACCOUNT_WEBHOOK_API_VERSION=3
ASAAS_SUBACCOUNT_WEBHOOK_EVENTS=PAYMENT_CREATED,PAYMENT_UPDATED,PAYMENT_CONFIRMED,PAYMENT_RECEIVED
ASAAS_SUBACCOUNT_ACCOUNT_WEBHOOK_URL=https://your-api.com/integrations/asaas
ASAAS_SUBACCOUNT_ACCOUNT_WEBHOOK_EVENTS=ACCOUNT_APPROVED,ACCOUNT_PENDING,ACCOUNT_REJECTED
```

#### Redis (Filas)
```env
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_USER=          # Opcional
REDIS_PASSWORD=      # Opcional
```

#### Firebase (Push Notifications - Opcional)
```env
FIREBASE_SERVICE_ACCOUNT_JSON={"type":"service_account",...}
```

#### Email (Prioridade: Mailchimp > SendGrid > Nodemailer)
```env
# Mailchimp
MAILCHIMP_API_KEY=
MAILCHIMP_FROM_EMAIL=
MAILCHIMP_FROM_NAME=

# SendGrid (Fallback)
SENDGRID_API_KEY=
SENDGRID_FROM_EMAIL=

# Nodemailer (Fallback local)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=
EMAIL_PASS=
```

#### Storage (S3/Railway)
```env
STORAGE_ACCESS_KEY_ID=
STORAGE_SECRET_ACCESS_KEY=
STORAGE_REGION=
STORAGE_BUCKET=
STORAGE_ENDPOINT=
```

#### Módulos da Aplicação
```env
APP_MODULES=all  # ou: auth,admin,payments,schools,students
NODE_ENV=development
```

#### Testes (Opcional)
```env
# URLs para scripts de teste
TEST_WEBHOOK_URL=http://localhost:3000
API_URL=http://localhost:3000
```

## 🛠️ Desenvolvimento

### Executar em modo desenvolvimento

```bash
# Executar todos os módulos
npm run dev

# Executar módulo específico
npm run dev:auth
npm run dev:schools
npm run dev:students
npm run dev:payments
npm run dev:admin
```

### Executar em modo produção (build)

```bash
# Build do projeto
npm run build

# Executar todos os módulos
npm start

# Executar módulo específico
npm run start:auth
npm run start:schools
npm run start:students
npm run start:payments
npm run start:admin
```

### Migrações do Banco de Dados

```bash
# Executar migrações
npm run migrate:run

# Gerar nova migração
npm run migrate:gen

# Executar migrações em produção
npm run migrate:run:prod
```

### Testes

```bash
# Executar todos os testes
npm test

# Executar testes em modo watch
npm run test:watch
```

## 📦 Deploy

### Deploy no Railway

O projeto inclui um script de deploy otimizado para Railway:

```bash
npm run deploy:railway
```

Este comando executa:
1. Instalação de dependências
2. Execução de testes
3. Build do projeto
4. Execução de migrações
5. Inicialização do servidor

### Deploy Manual

```bash
# 1. Build
npm run build

# 2. Migrações
npm run migrate:run:prod

# 3. Iniciar servidor
npm start
```

### Docker

```bash
# Build da imagem
docker build -t payments-api .

# Executar container
docker run -p 3000:3000 --env-file .env payments-api
```

### Docker Compose

```bash
# Subir todos os serviços (MySQL, Redis, API)
docker-compose up -d

# Ver logs
docker-compose logs -f

# Parar serviços
docker-compose down
```

## 🔄 Queues e Jobs

O projeto utiliza **BullMQ** com **Redis** para processamento assíncrono de jobs.

### Configuração do Worker

Para processar jobs da fila, é necessário executar o worker separadamente:

```bash
# Modo desenvolvimento (watch)
npm run worker

# Modo produção
node dist/infra/messaging/bullmq/outbox-worker.js
```

### Jobs Disponíveis

#### 1. Push Notifications (`push_notification`)
- **Descrição**: Envia notificações push para estudantes via Firebase FCM
- **Trigger**: Manual via API ou eventos do sistema
- **Configuração**: Requer `FIREBASE_SERVICE_ACCOUNT_JSON`

#### 2. Busca de Recibos (`fetch_payment_receipts`)
- **Descrição**: Busca recibos de transações pagas no Asaas
- **Frequência**: A cada 30 minutos (agendado)
- **Agendamento**: `npm run schedule:receipts`
- **Funcionalidades**:
  - Busca recibos para invoices pagas sem `receiptUrl`
  - Cria conta Asaas automaticamente se for primeira parcela

#### 3. Sincronização de Status (`sync_payment_status`)
- **Descrição**: Sincroniza status de pagamentos do Asaas (prevenção de falhas de webhook)
- **Frequência**: A cada 15 minutos (agendado)
- **Agendamento**: `npm run schedule:payment-sync`
- **Funcionalidades**:
  - Verifica invoices emitidas que podem ter sido pagas
  - Atualiza status e `paid_at` automaticamente

### Agendar Jobs

```bash
# Agendar job de busca de recibos
npm run schedule:receipts

# Agendar job de sincronização de pagamentos
npm run schedule:payment-sync
```

**Nota**: Os jobs precisam ser agendados apenas uma vez. O agendamento persiste no Redis.

### Verificar Status das Filas

O servidor exibe informações sobre a configuração de filas e push notifications no startup:

```
[Queue] BullMQ/outbox configurado (REDIS_HOST=localhost, REDIS_PORT=6379)
[Push] FCM configurado (project_id=your-project-id)
```

## 📁 Estrutura do Projeto

```
payments-api/
├── src/
│   ├── app/              # Camada de aplicação
│   │   ├── use-cases/    # Casos de uso
│   │   ├── presenters/   # Formatadores de saída
│   │   └── types/        # Tipos TypeScript
│   ├── domain/           # Camada de domínio
│   │   ├── entities/    # Entidades de negócio
│   │   └── value-objects/ # Value objects
│   ├── infra/            # Camada de infraestrutura
│   │   ├── http/         # Rotas Express
│   │   ├── db/           # TypeORM (entities, migrations)
│   │   ├── providers/    # Integrações externas
│   │   ├── messaging/    # BullMQ workers
│   │   └── cron/         # Jobs agendados
│   ├── ports/            # Interfaces (Ports)
│   │   ├── repositories/ # Interfaces de repositórios
│   │   └── providers/    # Interfaces de provedores
│   ├── bootstrap/        # Configuração e módulos
│   └── main.ts           # Entry point
├── test/                 # Testes unitários
├── docs/                 # Documentação
│   ├── openapi.yaml      # Especificação OpenAPI
│   ├── arquitetura.md    # Documentação de arquitetura
│   └── *.yaml            # Documentação por módulo
├── scripts/              # Scripts utilitários
└── docker/               # Configuração Docker
```

## 📚 Documentação da API

A documentação Swagger está disponível em:

```
http://localhost:3000/docs
```

### Arquivos de Documentação

- `docs/openapi.yaml` - Especificação principal
- `docs/auth.yaml` - Autenticação
- `docs/admin.yaml` - Operações administrativas
- `docs/schools.yaml` - Gestão de escolas
- `docs/students.yaml` - Gestão de estudantes
- `docs/payments.yaml` - Pagamentos

## 🧪 Scripts de Teste

```bash
# Testar webhooks do Asaas (pagamentos e contas)
npm run test:webhooks

# Testar webhooks com URL customizada
TEST_WEBHOOK_URL=http://localhost:3000 npm run test:webhooks

# Testar sincronização de pagamentos
npm run test:sync-payment-status

# Testar busca de recibos
npm run test:fetch-receipts

# Testar criação de escola completa
npm run test:create-school

# Testar fluxo completo
npm run test:flow
```

## 🔐 Segurança

- Autenticação via JWT (HMAC)
- Hash de senhas com Scrypt
- Validação de schemas com Zod
- Middleware de autenticação por persona (ADMIN, SCHOOL, STUDENT)
- CORS configurável

## 📝 Logs

O servidor exibe logs informativos sobre:
- Status de configuração de filas (Redis/BullMQ)
- Status de configuração de push notifications (FCM)
- Processamento de jobs
- Erros e warnings

## 🤝 Contribuindo

1. Crie uma branch para sua feature (`git checkout -b feature/nova-feature`)
2. Commit suas mudanças (`git commit -m 'Adiciona nova feature'`)
3. Push para a branch (`git push origin feature/nova-feature`)
4. Abra um Pull Request

## 📄 Licença

ISC

## 🆘 Suporte

Para dúvidas ou problemas:
1. Verifique a documentação em `docs/`
2. Consulte os logs do servidor
3. Verifique as variáveis de ambiente
4. Execute os testes para validar a configuração

---

**Desenvolvido com ❤️ seguindo Clean Architecture**
