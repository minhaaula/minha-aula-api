# cURL — verificação WhatsApp (cadastro e esqueci minha senha)

Variáveis úteis (ajuste conforme o ambiente):

```bash
export BASE_URL="http://localhost:3000"
```

Servidor precisa de **Twilio Verify** configurado (`TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_VERIFY_SERVICE_SID`).

---

## 1. Cadastro de usuário (fluxo completo)

### 1.1 Pedir código no WhatsApp (signup)

```bash
curl -sS -X POST "${BASE_URL}/auth/verification/request" \
  -H "Content-Type: application/json" \
  -d '{
    "purpose": "signup",
    "phone": "11999999999"
  }'
```

Resposta esperada (201): `challengeId`, `purpose`, `expiresAt`, `message`.

### 1.2 Validar o código recebido no WhatsApp

Substitua `CHALLENGE_ID` e `CODIGO` pelos valores reais.

```bash
curl -sS -X POST "${BASE_URL}/auth/verification/verify" \
  -H "Content-Type: application/json" \
  -d '{
    "challengeId": "CHALLENGE_ID",
    "code": "CODIGO"
  }'
```

Resposta esperada (200): `phoneVerificationToken`, `purpose`, `challengeId`.

### 1.3 Registrar usuário (com token da etapa anterior)

O `phone` deve ser o **mesmo** número validado (mesma normalização que o app usa). Substitua `PHONE_VERIFICATION_TOKEN`.

```bash
curl -sS -X POST "${BASE_URL}/auth/register" \
  -H "Content-Type: application/json" \
  -d '{
    "fullName": "Maria Silva",
    "birthDate": "1990-05-23",
    "email": "maria.silva@example.com",
    "phone": "11999999999",
    "cpf": "12345678909",
    "address": {
      "street": "Rua das Flores",
      "number": "123",
      "complement": null,
      "district": "Centro",
      "city": "São Paulo",
      "state": "SP",
      "zipCode": "01234000"
    },
    "persona": "STUDENT",
    "password": "SenhaSegura123",
    "phoneVerificationToken": "PHONE_VERIFICATION_TOKEN"
  }'
```

---

## 2. Esqueci minha senha (usuário — `/auth`)

### 2.1 Pedir código no WhatsApp (reset)

Identificação por **CPF** (apenas dígitos), alinhado ao login do aluno.

```bash
curl -sS -X POST "${BASE_URL}/auth/verification/request" \
  -H "Content-Type: application/json" \
  -d '{
    "purpose": "user_password_reset",
    "cpf": "12345678909"
  }'
```

Se o CPF existir e houver telefone, resposta **201** com `challengeId`. Caso contrário, **200** só com `message` (mensagem genérica).

### 2.2 Validar código

```bash
curl -sS -X POST "${BASE_URL}/auth/verification/verify" \
  -H "Content-Type: application/json" \
  -d '{
    "challengeId": "CHALLENGE_ID",
    "code": "CODIGO"
  }'
```

Resposta (200): `resetToken`, `purpose`, `challengeId`.

### 2.3 Definir nova senha

```bash
curl -sS -X POST "${BASE_URL}/auth/password/reset" \
  -H "Content-Type: application/json" \
  -d '{
    "token": "RESET_TOKEN",
    "newPassword": "NovaSenha123"
  }'
```

### 2.4 (Opcional) Validar token antes de enviar a nova senha

```bash
curl -sS -X POST "${BASE_URL}/auth/password/validate" \
  -H "Content-Type: application/json" \
  -d '{
    "token": "RESET_TOKEN"
  }'
```

---

## 3. Esqueci minha senha (escola — `/schools/password`)

### 3.1 Pedir código no WhatsApp

```bash
curl -sS -X POST "${BASE_URL}/schools/password/otp/request" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "proprietario@escola.com"
  }'
```

### 3.2 Validar código

```bash
curl -sS -X POST "${BASE_URL}/schools/password/otp/verify" \
  -H "Content-Type: application/json" \
  -d '{
    "challengeId": "CHALLENGE_ID",
    "code": "CODIGO"
  }'
```

### 3.3 Nova senha da escola

```bash
curl -sS -X POST "${BASE_URL}/schools/password/reset" \
  -H "Content-Type: application/json" \
  -d '{
    "token": "RESET_TOKEN",
    "newPassword": "NovaSenha123"
  }'
```

### 3.4 (Opcional) Validar token

```bash
curl -sS -X POST "${BASE_URL}/schools/password/validate" \
  -H "Content-Type: application/json" \
  -d '{
    "token": "RESET_TOKEN"
  }'
```

---

## 4. Dicas

- Código: string numérica com **4 a 8 dígitos** (conforme Twilio / digitação).
- Em **produção**, o Swagger em `/docs` pode exigir autenticação HTTP Basic (`SWAGGER_USERNAME` / `SWAGGER_PASSWORD`); inclua então:
  `-u "USUARIO:SENHA"` nos `curl` contra `/docs` (não é necessário para as rotas JSON acima, só para o Swagger UI).
