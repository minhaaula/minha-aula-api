# Como Criar e Testar Contas Asaas no Sandbox

## Visão Geral

O ambiente Sandbox da Asaas permite testar todo o fluxo de criação de subcontas e processo de KYC (Know Your Customer) sem afetar o ambiente de produção.

## Configuração Inicial

### 1. Criar Conta Principal no Sandbox

1. Acesse [https://sandbox.asaas.com/](https://sandbox.asaas.com/)
2. Crie uma conta principal (conta master)
3. Após o cadastro, você receberá uma API Key do sandbox
4. Configure sua conta no painel do sandbox:
   - Acesse "Minha Conta" → "Configurações" → "Sandbox"
   - Ative as funcionalidades que deseja testar

### 2. Obter API Key do Sandbox

A API Key do sandbox tem o formato:
```
$aact_hmlg_XXXXXXXX...
```

**Importante:** A API Key do sandbox é diferente da API Key de produção.

## Criando Subcontas no Sandbox

### Usando o Script de Teste

O script `test-create-asaas-account.ts` já está configurado para usar o sandbox por padrão:

```bash
# Configurar variáveis de ambiente
export ASAAS_API_KEY="sua-api-key-do-sandbox"
export ASAAS_BASE_URL="https://api-sandbox.asaas.com/v3"  # Já é o padrão
export ACCOUNT_EXTERNAL_REF="uuid-da-escola"  # Opcional: para salvar no banco

# Executar o script
npm run test:asaas-account
# ou
npx tsx scripts/test-create-asaas-account.ts
```

### Processo de KYC no Sandbox

No sandbox, o processo de KYC funciona de forma simplificada:

1. **Criação da Conta**: A conta é criada imediatamente
2. **Status Inicial**: Geralmente começa com status `PENDING` ou `AWAITING_APPROVAL`
3. **Aprovação**: No sandbox, a aprovação pode ser automática ou manual (dependendo da configuração)
4. **Webhooks**: Os webhooks de status são enviados normalmente

### Status Possíveis da Conta

- `PENDING` - Aguardando aprovação
- `AWAITING_APPROVAL` - Em análise
- `APPROVED` - Aprovada e pronta para uso
- `REJECTED` - Rejeitada

## Testando o Fluxo Completo

### 1. Criar Subconta

```bash
npm run test:asaas-account
```

O script irá:
- Criar a subconta na Asaas
- Exibir o `accountId` e `apiKey` retornados
- Configurar webhooks (se `ASAAS_SUBACCOUNT_WEBHOOK_URL` estiver definido)
- Salvar no banco de dados (se `ACCOUNT_EXTERNAL_REF` for um UUID válido)

### 2. Verificar Status da Conta

Após criar a conta, o script busca os detalhes completos e mostra o status atual.

### 3. Aguardar Webhooks

Se os webhooks estiverem configurados, você receberá eventos como:
- `ACCOUNT_STATUS_GENERAL_APPROVAL_PENDING` - Aguardando aprovação
- `ACCOUNT_STATUS_GENERAL_APPROVAL_APPROVED` - Conta aprovada

### 4. Testar Criação de PIX

Após a conta ser aprovada, você pode testar a criação de PIX:

```bash
npm run test:pix
```

O PIX será criado usando a API key da subconta da escola.

## Dados de Teste para Sandbox

### CNPJ de Teste

No sandbox, você pode usar CNPJs de teste. Exemplos:
- `69603295000197` (usado no script)
- Outros CNPJs válidos para teste

### Email de Teste

Use emails válidos, mas não precisam ser reais. Exemplo:
- `teste-${Date.now()}@example.com`

## Diferenças entre Sandbox e Produção

| Aspecto | Sandbox | Produção |
|---------|---------|----------|
| URL Base | `https://api-sandbox.asaas.com/v3` | `https://www.asaas.com/api/v3` |
| API Key | Começa com `$aact_hmlg_` | Começa com `$aact_YTUw_` |
| KYC | Processo simplificado | Processo completo com documentos |
| Aprovação | Pode ser automática | Requer análise manual |
| Pagamentos | Não são reais | São reais |

## Troubleshooting

### Conta não é aprovada automaticamente

No sandbox, algumas contas podem precisar de aprovação manual. Verifique:
1. Se todos os dados obrigatórios foram fornecidos
2. Se o CNPJ é válido
3. Se os webhooks estão configurados corretamente

### API Key não retornada

Se a API Key não for retornada na criação:
1. Verifique os detalhes da conta após a criação
2. A API Key pode ser gerada posteriormente
3. Use o endpoint `GET /accounts/{accountId}` para buscar a API Key

### Webhooks não chegam

1. Verifique se `ASAAS_SUBACCOUNT_WEBHOOK_URL` está configurado
2. Use uma ferramenta como [webhook.site](https://webhook.site) para testar
3. Verifique se o servidor está acessível publicamente

## Referências

- [Documentação Asaas - Sandbox](https://docs.asaas.com/docs/duvidas-frequentes-sandbox)
- [Documentação Asaas - Configurar Conta no Sandbox](https://docs.asaas.com/docs/como-configurar-sua-conta-no-sandbox)
- [Documentação Asaas - API de Contas](https://docs.asaas.com/reference/criar-subconta)

