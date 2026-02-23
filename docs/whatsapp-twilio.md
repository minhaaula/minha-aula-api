# Integração Twilio WhatsApp – Passo a passo

Este guia descreve como configurar e usar o envio de notificações via WhatsApp usando Twilio na API.

## 1. Conta Twilio e Sandbox WhatsApp

1. Crie uma conta em [twilio.com](https://www.twilio.com) e acesse o **Console**.
2. No menu, vá em **Messaging** → **Try it out** → **Send a WhatsApp message** (ou **Sandbox**).
3. Ative o **WhatsApp Sandbox**: você verá um número (ex: `+1 415 523 8886`) e uma mensagem de opt-in (ex: "join &lt;palavra&gt;").
4. No seu WhatsApp, envie essa mensagem de opt-in para o número do sandbox para poder **receber** mensagens em modo de teste.
5. Anote:
   - **Account SID** e **Auth Token** (em Account Info no Console)
   - **From**: o número do sandbox no formato `whatsapp:+14155238886` (sem espaços).

## 2. Variáveis de ambiente

No seu `.env`:

```env
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=seu_auth_token
TWILIO_WHATSAPP_FROM=whatsapp:+14155238886
```

O valor de `TWILIO_WHATSAPP_FROM` deve ser exatamente o número do sandbox (ou do seu número WhatsApp Business aprovado) com o prefixo `whatsapp:`.

## 3. Worker em execução

O envio é feito pelo **worker BullMQ**, que processa jobs do tipo `whatsapp_notification`. Suba o worker:

```bash
npm run worker
```

Com módulos completos (API + worker), use `APP_MODULES=all` e inicie a API; o worker pode rodar em outro processo com `npm run worker`.

## 4. Enfileirar mensagens

Há duas formas de payload para o job `whatsapp_notification`:

### Envio para um número (campo `to`)

Use quando você já tem o telefone do destinatário (ex: 11999999999 ou +5511999999999). O sistema normaliza para E.164 (Brasil).

Exemplo em código (em um use case ou rota):

```ts
await outbox.enqueue({
    type: 'whatsapp_notification',
    aggregateId: 'algum-id',
    payload: {
        message: 'Olá! Sua mensalidade foi confirmada.',
        to: '11999999999'
    }
});
```

### Envio para vários usuários (campo `userIds`)

O worker resolve o telefone de cada usuário pelo repositório (campo `phone`). Usuários sem telefone são ignorados.

```ts
await outbox.enqueue({
    type: 'whatsapp_notification',
    aggregateId: notificationId,
    payload: {
        message: 'Lembrete: aula amanhã às 10h.',
        userIds: ['user-uuid-1', 'user-uuid-2']
    }
});
```

## 5. Produção

Para uso em produção com WhatsApp Business:

1. Solicite um **número WhatsApp Business** e aprovação no Twilio/WhatsApp.
2. Atualize `TWILIO_WHATSAPP_FROM` com esse número (ex: `whatsapp:+5511999999999`).
3. Mantenha o worker rodando e com as mesmas variáveis Twilio configuradas.

## Arquitetura no projeto

- **Port**: `src/ports/providers/whatsapp-provider.port.ts`
- **Adapter**: `src/infra/providers/twilio/whatsapp-provider.ts`
- **Factory**: `src/infra/providers/twilio/create-whatsapp-provider.ts` (lê variáveis de ambiente)
- **Worker**: job `whatsapp_notification` em `src/infra/messaging/bullmq/worker-manager.ts`
- **Telefone**: normalização BR → E.164 em `src/shared/phone-e164.ts` (`toE164Brazil`)
