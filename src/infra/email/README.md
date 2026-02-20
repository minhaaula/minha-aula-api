# 📧 Templates de Email - Minha Aula

Este diretório contém templates HTML e o serviço de envio de emails transacionais.

## 📁 Estrutura

```
email/
├── templates/
│   ├── base-template.ts           # Template base (para emails que usam layout comum)
│   ├── password-reset.template.ts   # Redefinição de senha
│   ├── welcome.template.ts         # Boas-vindas / novo cadastro
│   ├── email-confirmation.template.ts   # Confirmação de email
│   ├── payment-notification.template.ts # Notificação de pagamento confirmado
│   ├── boleto-notification.template.ts  # Notificação de boleto gerado
│   └── index.ts
├── template-engine.ts
├── email-service.ts
└── README.md
```

## 🎨 Templates disponíveis

### 1. Reset de Senha
- **Variáveis:** `resetUrl`
- **Uso:** `getPasswordResetTemplate({ resetUrl })` ou `emailService.sendPasswordResetEmail({ to, resetUrl })`

### 2. Novo Cadastro / Bem-vindo
- **Variáveis:** `userName`, `userEmail` (opcional), `planName` (opcional), `loginUrl` (opcional)
- **Uso:** `getWelcomeTemplate(data)` ou `emailService.sendWelcomeEmail({ to, ...data })`

### 3. Confirmação de Email
- **Variáveis:** `userName`, `confirmationUrl`
- **Uso:** `getEmailConfirmationTemplate(data)` ou `emailService.sendEmailConfirmationEmail({ to, ...data })`

### 4. Notificação de Pagamento
- **Variáveis:** `userName`, `amount`, `paymentDate`, `paymentMethod`, `transactionId`, `invoiceUrl`
- **Uso:** `getPaymentNotificationTemplate(data)` ou `emailService.sendPaymentNotificationEmail({ to, ...data })`

### 5. Notificação de Boleto
- **Variáveis:** `studentName`, `boletoUrl`, `digitableLine`, `amount`, `dueDate`, `description`, `type`, etc.
- **Uso:** `getBoletoNotificationTemplate(data)` (sem método dedicado no EmailService; usar `sendCustomEmail` com o template).

### 6. Boas-vindas Escola
- **Variáveis:** `schoolName`, `schoolEmail`, `ownerName` (opcional), `loginUrl` (opcional)
- **Uso:** `getWelcomeSchoolTemplate(data)` ou `emailService.sendWelcomeSchoolEmail({ to, ...data })`. O cadastro de escola (CreateSchool) **enfileira** um job `send_welcome_school_email`; o **worker** (módulo admin) processa e envia o email.

### 7. Boas-vindas Aluno
- **Variáveis:** `userName`, `userEmail` (opcional), `loginUrl` (opcional)
- **Uso:** `getWelcomeStudentTemplate(data)` ou `emailService.sendWelcomeStudentEmail({ to, ...data })`. O cadastro de aluno (RegisterUser, persona STUDENT) **enfileira** um job `send_welcome_student_email`; o **worker** processa e envia.

### 8. Confirmação de Matrícula
- **Variáveis:** `studentName`, `courseName`, `schoolName`, `className` (opcional), `loginUrl` (opcional)
- **Uso:** `getEnrollmentConfirmationTemplate(data)` ou `emailService.sendEnrollmentConfirmationEmail({ to, ...data })`. A matrícula (EnrollStudent) **enfileira** um job `send_enrollment_confirmation_email`; o **worker** processa e envia.

## Fila de notificações (BullMQ)

Os emails de boas-vindas e de confirmação de matrícula são **enfileirados** (outbox) por qualquer módulo (auth, schools). O **envio real** é feito apenas pelo **worker**, que é iniciado quando o **módulo admin** está ativo. Assim, o sistema inteiro pode publicar eventos na fila, mas só o processo que roda o admin (ou `npm run worker`) processa os jobs e envia os emails.

## 🚀 Uso com EmailService

```typescript
import { EmailService } from '../infra/email/email-service';

const emailService = new EmailService(emailProvider);

// Reset de senha
await emailService.sendPasswordResetEmail({
    to: 'user@example.com',
    resetUrl: 'https://app.minhaaula.com/reset-password?token=abc123'
});

// Boas-vindas
await emailService.sendWelcomeEmail({
    to: 'user@example.com',
    userName: 'João Silva',
    userEmail: 'joao@example.com',
    planName: 'Plano Premium',
    loginUrl: 'https://app.minhaaula.com/login'
});

// Confirmação de email
await emailService.sendEmailConfirmationEmail({
    to: 'user@example.com',
    userName: 'João Silva',
    confirmationUrl: 'https://app.minhaaula.com/confirm-email?token=xyz789'
});

// Notificação de pagamento
await emailService.sendPaymentNotificationEmail({
    to: 'user@example.com',
    userName: 'João Silva',
    amount: 'R$ 199,90',
    paymentDate: '15/01/2025',
    paymentMethod: 'Cartão de Crédito',
    transactionId: 'TXN-123456',
    invoiceUrl: 'https://app.minhaaula.com/invoices/123'
});
```

## Providers suportados

- **Twilio SendGrid:** `SENDGRID_API_KEY`, `SENDGRID_FROM_EMAIL`, `SENDGRID_FROM_NAME` (ex.: "Minha Aula")
- **Nodemailer:** `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_USER`, `EMAIL_PASS`, `EMAIL_FROM`

## Características dos templates

- Responsivos e compatíveis com clientes de email
- CSS inline para máxima compatibilidade
- Layout em tabelas HTML (padrão para email)
- Branding Minha Aula (footer © 2025)

## Notas

1. Os use cases `RequestPasswordReset` e `RequestUserPasswordReset` atualmente montam o email manualmente; para usar estes templates neles, refatore para injetar e usar `EmailService.sendPasswordResetEmail`.
2. Substitua sempre as variáveis `{{nome}}` antes de enviar (as funções `get*Template` já fazem isso).
3. Teste em vários clientes de email antes de usar em produção.
