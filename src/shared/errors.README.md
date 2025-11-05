# Sistema de Erros Padronizado

Este sistema centraliza todas as mensagens de erro da aplicação, garantindo consistência e facilitando a manutenção.

## Uso Básico

```typescript
import { AppError, ErrorCode } from '../../shared/errors';

// Usar código de erro pré-definido
throw AppError.fromCode(ErrorCode.USER_NOT_FOUND, { userId: '123' });

// Criar erro customizado de validação
throw AppError.validation('CPF deve ter 11 dígitos', { cpf: input.cpf });

// Criar erro de não encontrado
throw AppError.notFound('Usuário', { userId: '123' });

// Criar erro de autorização
throw AppError.unauthorized('Token expirado');
```

## Códigos de Erro

Os códigos estão organizados por categoria:

- **1000-1999**: Validação (INVALID_*, VALIDATION_*)
- **2000-2999**: Não encontrado (*_NOT_FOUND)
- **3000-3999**: Conflito (ALREADY_*, *_ALREADY_EXISTS)
- **4000-4999**: Autorização (UNAUTHORIZED, FORBIDDEN, NOT_ALLOWED)
- **5000-5999**: Configuração (CONFIGURATION_*, MISSING_*)
- **6000-6999**: Regras de negócio (BUSINESS_RULE_VIOLATION, CANNOT_*)
- **7000-7999**: Sistema (INTERNAL_ERROR, DATABASE_ERROR)

## Formato de Resposta HTTP

Quando um `AppError` é lançado, o middleware do Express automaticamente formata a resposta:

```json
{
  "error": "Usuário não encontrado",
  "code": "USER_NOT_FOUND",
  "details": {
    "userId": "123"
  }
}
```

## Adicionando Novos Códigos

1. Adicione o código em `ErrorCode` enum
2. Adicione a mensagem em `ErrorMessages`
3. Use `AppError.fromCode()` no código

## Migração

Para migrar código existente:

**Antes:**
```typescript
throw new Error('User not found');
```

**Depois:**
```typescript
throw AppError.fromCode(ErrorCode.USER_NOT_FOUND, { userId });
```

