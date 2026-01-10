# Sistema de Email

Este diretório contém a estrutura de templates e serviços de email do projeto.

## Estrutura

```
email/
├── templates/
│   ├── base-template.ts      # Template base HTML para todos os emails
│   ├── password-reset.template.ts  # Template de redefinição de senha
│   ├── welcome.template.ts    # Template de boas-vindas
│   └── index.ts              # Exportações dos templates
├── template-engine.ts        # Engine de renderização de templates
├── email-service.ts          # Serviço facilitador para envio de emails
└── README.md                 # Esta documentação
```

## Providers Suportados

### Twilio SendGrid (Recomendado)

Configure as seguintes variáveis de ambiente:

```bash
SENDGRID_API_KEY=your_api_key_here
SENDGRID_FROM_EMAIL=noreply@example.com
SENDGRID_FROM_NAME="Payments API"  # Opcional
```

### Nodemailer (Fallback)

Configure as seguintes variáveis de ambiente:

```bash
EMAIL_HOST=smtp.example.com
EMAIL_PORT=587
EMAIL_USER=user@example.com
EMAIL_PASS=password
EMAIL_FROM=noreply@example.com
```

## Uso dos Templates

### Exemplo 1: Email de Redefinição de Senha

```typescript
import { EmailService } from '../infra/email/email-service';
import { getPasswordResetTemplate } from '../infra/email/templates';

// Opção 1: Usando EmailService (recomendado)
const emailService = new EmailService(emailProvider);
await emailService.sendPasswordResetEmail({
    to: 'user@example.com',
    resetUrl: 'https://app.example.com/reset-password?token=abc123',
    expiresIn: '1 hora',
    userName: 'João Silva' // Opcional
});

// Opção 2: Usando template diretamente
const template = getPasswordResetTemplate({
    resetUrl: 'https://app.example.com/reset-password?token=abc123',
    expiresIn: '1 hora'
});

await emailProvider.sendEmail({
    to: 'user@example.com',
    subject: template.subject,
    html: template.html,
    text: template.text
});
```

### Exemplo 2: Email de Boas-vindas

```typescript
import { EmailService } from '../infra/email/email-service';

const emailService = new EmailService(emailProvider);
await emailService.sendWelcomeEmail({
    to: 'user@example.com',
    userName: 'João Silva',
    loginUrl: 'https://app.example.com/login' // Opcional
});
```

## Criando Novos Templates

1. Crie um novo arquivo em `templates/`:

```typescript
// templates/my-template.template.ts
import { EmailTemplate } from '../template-engine';
import { buildBaseEmailHtml } from './base-template';

export interface MyTemplateData {
    userName: string;
    customField: string;
}

export function getMyTemplate(data: MyTemplateData): EmailTemplate {
    const content = `
        <p>Olá <strong>${data.userName}</strong>,</p>
        <p>${data.customField}</p>
    `;

    return {
        subject: 'Meu Assunto',
        html: buildBaseEmailHtml({
            title: 'Meu Título',
            content,
            footerText: 'Footer customizado',
            companyName: 'Payments API'
        }),
        text: `Olá ${data.userName},\n\n${data.customField}`
    };
}
```

2. Exporte no `templates/index.ts`:

```typescript
export * from './my-template.template';
```

3. Adicione método no `EmailService` se necessário:

```typescript
async sendMyEmail(data: MyTemplateData & { to: string }): Promise<void> {
    const template = getMyTemplate(data);
    await this.emailProvider.sendEmail({
        to: data.to,
        subject: template.subject,
        html: template.html,
        text: template.text
    });
}
```

## Template Base

O template base (`base-template.ts`) fornece uma estrutura HTML responsiva e profissional para todos os emails. Ele inclui:

- Layout responsivo
- Estilos CSS inline
- Header com título
- Área de conteúdo
- Footer com informações da empresa

Você pode customizar o template base conforme necessário.

## Instalação do Twilio SendGrid

Para usar o Twilio SendGrid, instale o pacote:

```bash
npm install @sendgrid/mail
```

O adapter detectará automaticamente se o pacote está instalado e usará o SendGrid quando as variáveis de ambiente estiverem configuradas.









