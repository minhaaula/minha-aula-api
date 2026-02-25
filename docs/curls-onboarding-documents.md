# Curls para testar onboarding de documentos (Asaas)

Substitua as variáveis antes de rodar:
- `BASE_URL` – ex.: `http://localhost:3000`
- `ADMIN_TOKEN` – JWT retornado no login admin
- `SCHOOL_TOKEN` – JWT retornado no login da escola
- `SCHOOL_ID` – UUID da escola (ex.: do GET /admin/schools ou do login da escola)
- `DOCUMENT_GROUP_ID` – `id` de um item retornado em sync-onboarding-documents ou GET /schools/kyc/documents
- `CAMINHO_DO_ARQUIVO` – ex.: `./documento.pdf` ou `./foto.jpg`

---

## 1. Obter token Admin

```bash
curl -s -X POST "$BASE_URL/admin/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"seu-email-admin@exemplo.com","password":"sua-senha"}'
```

Copie o `token` da resposta e use como `ADMIN_TOKEN`.

---

## 2. Obter token da Escola

```bash
curl -s -X POST "$BASE_URL/schools/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"escola@exemplo.com","password":"senha-da-escola"}'
```

Copie o `token` da resposta e use como `SCHOOL_TOKEN`. O `schoolId` (ou dado equivalente) pode ser usado como `SCHOOL_ID` se a API retornar.

---

## 3. Admin – Sincronizar documentos (lista de grupos)

Retorna os grupos de documentos pendentes e atualiza a `onboardingUrl` na escola. Use os `id` e `type` dos itens para o upload.

```bash
curl -s -X POST "$BASE_URL/admin/schools/$SCHOOL_ID/sync-onboarding-documents" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json"
```

Exemplo de resposta (use um `id` como `DOCUMENT_GROUP_ID` e o mesmo `type` no upload):

```json
{
  "schoolId": "...",
  "documents": [
    { "id": "uuid-do-grupo", "type": "IDENTIFICATION", "title": "...", ... },
    { "id": "outro-uuid", "type": "SOCIAL_CONTRACT", ... }
  ],
  "onboardingUrl": "https://...",
  "onboardingUrlUpdated": false
}
```

---

## 4. Admin – Enviar documento (upload manual)

Envia um arquivo para um grupo retornado no sync. O `type` deve ser um dos: `IDENTIFICATION`, `IDENTIFICATION_SELFIE`, `MINUTES_OF_ELECTION`, `SOCIAL_CONTRACT`, `OTHER`.

```bash
curl -s -X POST "$BASE_URL/admin/schools/$SCHOOL_ID/documents/$DOCUMENT_GROUP_ID/upload" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -F "documentFile=@$CAMINHO_DO_ARQUIVO" \
  -F "type=IDENTIFICATION"
```

Exemplo com arquivo e tipo explícitos:

```bash
curl -s -X POST "http://localhost:3000/admin/schools/SEU-SCHOOL-ID/documents/SEU-DOCUMENT-GROUP-ID/upload" \
  -H "Authorization: Bearer SEU_ADMIN_TOKEN" \
  -F "documentFile=@./documento.pdf" \
  -F "type=IDENTIFICATION"
```

---

## 5. Escola – Listar documentos pendentes (KYC)

A escola autenticada consulta os próprios documentos pendentes. Os `id` retornados são os `documentGroupId` para o upload.

```bash
curl -s -X GET "$BASE_URL/schools/kyc/documents" \
  -H "Authorization: Bearer $SCHOOL_TOKEN" \
  -H "Content-Type: application/json"
```

Exemplo de resposta:

```json
{
  "documents": [
    { "id": "uuid-do-grupo", "type": "IDENTIFICATION", "title": "...", "onboardingUrl": "..." },
    ...
  ],
  "onboardingUrl": "https://..."
}
```

---

## 6. Escola – Sincronizar documentos

A escola autenticada pode sincronizar os próprios documentos com o Asaas e atualizar a `onboardingUrl`. Use para forçar atualização (onboarding manual).

```bash
curl -s -X POST "$BASE_URL/schools/kyc/sync-onboarding-documents" \
  -H "Authorization: Bearer $SCHOOL_TOKEN" \
  -H "Content-Type: application/json"
```

Resposta igual à do admin sync (schoolId, documents, onboardingUrl, onboardingUrlUpdated).

---

## 7. Escola – Enviar documento (upload manual)

A escola envia documento para a própria conta. Use um `id` e o `type` retornados em GET /schools/kyc/documents.

```bash
curl -s -X POST "$BASE_URL/schools/kyc/documents/$DOCUMENT_GROUP_ID/upload" \
  -H "Authorization: Bearer $SCHOOL_TOKEN" \
  -F "documentFile=@$CAMINHO_DO_ARQUIVO" \
  -F "type=IDENTIFICATION"
```

Exemplo com valores fixos:

```bash
curl -s -X POST "http://localhost:3000/schools/kyc/documents/SEU-DOCUMENT-GROUP-ID/upload" \
  -H "Authorization: Bearer SEU_SCHOOL_TOKEN" \
  -F "documentFile=@./documento.pdf" \
  -F "type=IDENTIFICATION"
```

---

## Variáveis em um único lugar (bash)

Para testar em sequência, defina antes:

```bash
export BASE_URL="http://localhost:3000"
export ADMIN_TOKEN="cole-o-token-admin-aqui"
export SCHOOL_TOKEN="cole-o-token-escola-aqui"
export SCHOOL_ID="uuid-da-escola"
export DOCUMENT_GROUP_ID="uuid-do-grupo-retornado-no-sync-ou-kyc"
export CAMINHO_DO_ARQUIVO="./documento.pdf"
```

Depois rode os curls acima usando `$BASE_URL`, `$ADMIN_TOKEN`, etc.
