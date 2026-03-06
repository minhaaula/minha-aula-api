# Crons e jobs (BullMQ)

Todos os crons e tarefas agendadas do sistema rodam via **BullMQ** (fila `outbox`). Não é necessário configurar cron do sistema operacional.

## Requisitos

- **Redis** configurado (`REDIS_HOST`, opcionalmente `REDIS_PORT`, `REDIS_PASSWORD`)
- **Módulo admin ativo** (`APP_MODULES=admin` ou `APP_MODULES=all`) para que o scheduler e o worker subam com a API

Se o worker rodar em processo separado, use:

```bash
npm run worker
# ou
node dist/infra/messaging/bullmq/outbox-worker.js
```

## Jobs agendados (repeatable)

| Job | Frequência | Descrição |
|-----|------------|-----------|
| `fetch_payment_receipts` | A cada 30 min | Busca recibos de pagamento no Asaas, atualiza faturas de plano |
| `sync_payment_status` | A cada 15 min | Sincroniza status de pagamentos (faturas de plano) com o Asaas |
| `fetch_school_onboarding_url` | A cada 2 min | Busca URL de onboarding para escolas com conta Asaas e sem URL salva |
| `schedule_charge_due_reminders` | A cada 6 h | Identifica cobranças a vencer em até 10 dias e enfileira e-mails de lembrete |
| `generate_monthly_tuition_charges` | A cada 5 min | Gera cobranças de mensalidade do próximo mês para matrículas ativas |
| `send_boleto_notifications` | Diariamente 09:00 | Envia e-mail sobre boletos criados nas últimas 24h (escolas e alunos) |

Horários em **America/Sao_Paulo**.

## Jobs sob demanda

Enfileirados pela aplicação em eventos específicos:

| Job | Quando |
|-----|--------|
| `ensure_school_asaas_account` | Após criar/emitir fatura de plano para escola |
| `push_notification` | Quando o sistema envia notificação push (FCM) |
| `send_welcome_school_email` | Cadastro de escola |
| `send_welcome_student_email` | Cadastro de estudante |
| `send_enrollment_confirmation_email` | Confirmação de matrícula |
| `send_charge_due_reminder_email` | Disparado por `schedule_charge_due_reminders` |

## Scripts CLI (uma execução)

Para rodar manualmente a lógica dos crons (teste ou fallback), sem BullMQ:

```bash
npm run cron:monthly-charges   # Geração de mensalidades
npm run cron:boleto-notifications  # Notificações de boleto
```

## Arquivos

- **Agendamento**: `src/infra/messaging/bullmq/job-scheduler.ts` — `scheduleAllJobs()`
- **Processamento**: `src/infra/messaging/bullmq/worker-manager.ts` — worker da fila `outbox`
- **Lógica dos crons**: `src/infra/cron/generate-monthly-charges.ts`, `src/infra/cron/send-boleto-notifications.ts`
