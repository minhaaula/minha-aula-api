# cURL — níveis, promoções, certificados e timeline por matrícula

Rotas autenticadas da **persona escola** (`Bearer` JWT). O contexto da escola vem do próprio token (`resolve-school-context`); **não** é necessário enviar `schoolId` na URL.

Pré-requisito: migration `1000000000075-enrollment-levels-certificates-timeline` aplicada (`npm run migrate:run`).

Variáveis úteis:

```bash
export BASE_URL="http://localhost:3000"
export SCHOOL_EMAIL="owner@escola.com"
export SCHOOL_PASSWORD="sua_senha"

# após o login:
export SCHOOL_TOKEN="<accessToken retornado>"
```

## 1. Login da escola

```bash
curl -sS -X POST "${BASE_URL}/schools/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"${SCHOOL_EMAIL}\",\"password\":\"${SCHOOL_PASSWORD}\"}"
```

Guarde `accessToken` da resposta como `SCHOOL_TOKEN`:

```bash
export SCHOOL_TOKEN="eyJhbGciOi..."
```

## 2. Catálogo de níveis da escola

### 2.1 Listar níveis

```bash
curl -sS "${BASE_URL}/schools/student-levels" \
  -H "Authorization: Bearer ${SCHOOL_TOKEN}"
```

### 2.2 Criar nível

`sort_order` deve ser **único por escola**. `template_code` é opcional (também único por escola quando preenchido).

```bash
curl -sS -X POST "${BASE_URL}/schools/student-levels" \
  -H "Authorization: Bearer ${SCHOOL_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "label": "Faixa Branca",
    "sortOrder": 0,
    "templateCode": "belt_white"
  }'
```

Substitua pelos UUIDs retornados:

```bash
export LEVEL_INICIAL="<id do nível inicial>"
export LEVEL_PROXIMA="<id do próximo nível>"
```

## 3. Templates de certificado

### 3.1 Listar templates

```bash
curl -sS "${BASE_URL}/schools/certificate-templates" \
  -H "Authorization: Bearer ${SCHOOL_TOKEN}"
```

### 3.2 Criar template

```bash
curl -sS -X POST "${BASE_URL}/schools/certificate-templates" \
  -H "Authorization: Bearer ${SCHOOL_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Certificado padrão",
    "logicalTemplateId": "cert_default_v1",
    "layoutConfig": { "orientation": "landscape" }
  }'
```

```bash
export CERT_TEMPLATE_ID="<id do template criado>"
```

## 4. Timeline agregada da matrícula (escola)

Eventos em ordem cronológica: matrícula, promoções, certificados e marcos customizados. A escola **não** vê eventos fora do período ativo da matrícula.

```bash
curl -sS "${BASE_URL}/schools/enrollments/${ENROLLMENT_ID}/timeline?limit=30&offset=0&order=asc" \
  -H "Authorization: Bearer ${SCHOOL_TOKEN}"
```

## 4.1 Visão resumida do progresso (nível atual + listas)

Use o UUID de uma matrícula dessa escola (ex.: lista de alunos / detalhes da turma no app).

```bash
export ENROLLMENT_ID="<uuid da matrícula>"

curl -sS "${BASE_URL}/schools/enrollments/${ENROLLMENT_ID}/progress?timelineLimit=30" \
  -H "Authorization: Bearer ${SCHOOL_TOKEN}"
```

## 5. Registrar promoção de nível

Define `toLevelId` obrigatório. Se `fromLevelId` for omitido, a origem será o **nível atual** da matrícula (ou vazio na primeira promoção).

```bash
curl -sS -X POST "${BASE_URL}/schools/enrollments/${ENROLLMENT_ID}/promotions" \
  -H "Authorization: Bearer ${SCHOOL_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "toLevelId": "'"${LEVEL_PROXIMA}"'",
    "notes": "Promoção após exame"
  }'
```

Resposta inclui `promotionId`. Guarde para o certificado:

```bash
export PROMOTION_ID="<promotionId>"
```

## 6. Evento de timeline

`occurredAt` é opcional (ISO-8601); se omitido, usa a hora do servidor. O `payload` é JSON livre.

```bash
curl -sS -X POST "${BASE_URL}/schools/enrollments/${ENROLLMENT_ID}/timeline-events" \
  -H "Authorization: Bearer ${SCHOOL_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "eventType": "EXAM_SCHEDULED",
    "payload": { "date": "2026-06-01", "location": "Matriz" }
  }'
```

## 7. Registrar certificado emitido (por promoção)

Uma promoção aceita **no máximo um** certificado. `documentUrl` pode ser `null` até o arquivo existir.

```bash
curl -sS -X POST "${BASE_URL}/schools/enrollments/${ENROLLMENT_ID}/promotions/${PROMOTION_ID}/certificates" \
  -H "Authorization: Bearer ${SCHOOL_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "certificateTemplateId": "'"${CERT_TEMPLATE_ID}"'",
    "documentUrl": null,
    "metadata": { "issuedBy": "secretaria" }
  }'
```

---

## Referência rápida dos caminhos

| Método | Caminho |
|--------|---------|
| `GET` | `/schools/student-levels` |
| `POST` | `/schools/student-levels` |
| `GET` | `/schools/certificate-templates` |
| `POST` | `/schools/certificate-templates` |
| `GET` | `/schools/enrollments/:enrollmentId/timeline` |
| `GET` | `/schools/enrollments/:enrollmentId/progress` |
| `POST` | `/schools/enrollments/:enrollmentId/promotions` |
| `POST` | `/schools/enrollments/:enrollmentId/timeline-events` |
| `POST` | `/schools/enrollments/:enrollmentId/promotions/:promotionId/certificates` |

**Aluno (app dos pais)** — timeline completa, inclusive após desmatrícula:

```bash
export STUDENT_TOKEN="<accessToken do aluno>"

curl -sS "${BASE_URL}/students/enrollments/${ENROLLMENT_ID}/timeline?limit=30&offset=0&order=asc" \
  -H "Authorization: Bearer ${STUDENT_TOKEN}"
```

| `GET` | `/students/enrollments/:enrollmentId/timeline` |

Modelo de dados: [modelo-niveis-certificados-timeline-matricula.md](./modelo-niveis-certificados-timeline-matricula.md).
