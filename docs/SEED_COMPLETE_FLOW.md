# Seed de Fluxo Completo

Este documento descreve a seed completa criada para testar todo o fluxo do sistema de pagamentos.

## 📋 O que foi criado

### Escolas (5)
1. **Escola Excelência** (CNPJ: 11111111000111)
   - Dono: Carlos Mendes (CPF: 65898370234)
   - Email: carlos.mendes@escolaexcelencia.com.br

2. **Instituto Conhecimento** (CNPJ: 22222222000222)
   - Dono: Maria Silva (CPF: 59307219206)
   - Email: maria.silva@institutoconhecimento.com.br

3. **Academia Sabedoria** (CNPJ: 33333333000333)
   - Dono: João Santos (CPF: 70507193407)
   - Email: joao.santos@academiasabedoria.com.br

4. **Centro Educacional** (CNPJ: 44444444000444)
   - Dono: Ana Costa (CPF: 78864357378)
   - Email: ana.costa@centroeducacional.com.br

5. **Escola Futuro** (CNPJ: 55555555000555)
   - Dono: Roberto Alves (CPF: 45958652109)
   - Email: roberto.alves@escolafuturo.com.br

### Estrutura por Escola
- **2 Cursos** por escola
  - Programação
  - Design
- **2 Classes** por curso
  - Turma A (Segunda e Quarta, 09:00-11:00)
  - Turma B (Terça e Quinta, 14:00-16:00)

### Estudantes (20 total - 4 por escola)
Cada escola tem 4 estudantes distribuídos entre as classes.

**Escola 1 - Exemplos:**
- Pedro Oliveira (CPF: 74767131090)
- Julia Ferreira (CPF: 14329910004)
- Lucas Souza (CPF: 65585863398)
- Mariana Lima (CPF: 38623008626)

### Matrículas
- 20 matrículas ativas (1 por estudante)
- Estudantes distribuídos entre as classes

### Enrollment Requests (Convites) - 4
Convites abertos (PENDING) para 4 escolas diferentes:
- req-001: Escola Excelência
- req-002: Instituto Conhecimento
- req-003: Academia Sabedoria
- req-004: Centro Educacional

### Cobranças Financeiras
- **60 cobranças** no total (3 por estudante)
- Tipos variados: TUITION, ENROLLMENT, MATERIALS
- Status variados: PAID, OPEN, OVERDUE
- Algumas com descontos aplicados

## 🔐 Credenciais

**Senha padrão para TODOS os usuários:** `S3nh4*secreta`

### Exemplos de Login

**Escolas:**
```bash
# Escola Excelência
CPF: 65898370234
Senha: S3nh4*secreta

# Instituto Conhecimento
CPF: 59307219206
Senha: S3nh4*secreta
```

**Estudantes:**
```bash
# Pedro Oliveira
CPF: 74767131090
Senha: S3nh4*secreta

# Julia Ferreira
CPF: 14329910004
Senha: S3nh4*secreta
```

## 🚀 Como usar

### 1. Executar a Migration

```bash
npm run migrate:run
```

Isso executará todas as migrations, incluindo a seed completa.

### 2. Verificar os dados

Você pode verificar os dados diretamente no banco de dados ou usar o script de teste:

```bash
npm run test:flow
```

O script testará:
- Login como escola
- Login como estudante
- Listagem de escolas, cursos, classes
- Listagem de matrículas
- Listagem de enrollment requests
- Listagem de cobranças financeiras

### 3. Gerar novo hash de senha (se necessário)

Se precisar gerar um novo hash para uma senha diferente:

```bash
npm run hash:password [sua-senha]
```

Sem argumentos, gera o hash para `S3nh4*secreta`.

## 📊 Estrutura de Dados

```
Escolas (5)
├── Cursos (2 por escola = 10 total)
│   ├── Classes (2 por curso = 20 total)
│   │   ├── Matrículas (20)
│   │   └── Enrollment Requests (4)
│   └── Cobranças Financeiras (60)
└── Estudantes (20)
```

## 🧪 Testando o Fluxo

### Com a API rodando

1. Inicie a API:
```bash
npm run dev
```

2. Em outro terminal, execute os testes:
```bash
npm run test:flow
```

### Testes manuais

1. **Login como escola:**
```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"cpf":"65898370234","password":"S3nh4*secreta"}'
```

2. **Login como estudante:**
```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"cpf":"74767131090","password":"S3nh4*secreta"}'
```

3. **Listar cobranças do estudante:**
```bash
curl -X GET http://localhost:3000/students/payments \
  -H "Authorization: Bearer [TOKEN_DO_ESTUDANTE]"
```

## 📝 Notas Importantes

- Todos os CPFs e CNPJs são fictícios e apenas para testes
- As datas das cobranças são relativas (Novembro/Dezembro 2024)
- Os valores estão em centavos (ex: 35000 = R$ 350,00)
- A seed é idempotente - pode ser executada múltiplas vezes sem duplicar dados

## 🔄 Rollback

Para reverter a seed:

```bash
npm run migrate:revert
```

Ou execute manualmente o método `down()` da migration.

## 📞 Suporte

Se encontrar problemas:
1. Verifique se o banco de dados está configurado corretamente
2. Certifique-se de que todas as migrations anteriores foram executadas
3. Verifique os logs da migration para erros específicos

