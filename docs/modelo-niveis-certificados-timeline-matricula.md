# Modelo de dados: níveis, promoções, certificados e timeline por matrícula

Este documento descreve a estrutura persistida para **níveis por matrícula**, **histórico de promoções**, **certificados** (ligados à promoção e à matrícula), **templates de certificado** e **eventos de timeline** da matrícula.

Implementação TypeORM sob `src/infra/db/typeorm/entities/` e migration `src/infra/db/typeorm/migrations/1000000000075-enrollment-levels-certificates-timeline.ts`.

> Não há rotas HTTP públicas específicas deste modelo neste repositório; a documentação OpenAPI não foi estendida para isso até existirem endpoints estáveis.

## Princípios

1. **Nível nunca é global ao aluno** — o estado atual e o histórico referem-se à **matrícula** (`enrollment_id`), não ao usuário nem ao dependente de forma isolada.
2. **Matrículas diferentes** podem ter níveis diferentes ao mesmo tempo, sem conflito (cada linha em `enrollments` pode apontar para um nível distinto ou `NULL`).
3. **Módulo opcional por escola** — se a escola não usa níveis/certificados, basta não popular `school_student_levels` (e opcionalmente manter `enrollments.current_school_student_level_id` como `NULL`). Nenhuma flag de configuração extra é obrigatória neste modelo.
4. **Desmatrícula preserva histórico** na prática usada pela API quando a matrícula **permanece** no banco (ex.: apenas mudança de `status`). O histórico continua ligado ao **mesmo** `id` de matrícula.

## Visão rápida (relacionamentos)

```mermaid
erDiagram
    School ||--o{ SchoolStudentLevel : catalogo
    School ||--o{ SchoolCertificateTemplate : modelos
    Enrollment }o--o| SchoolStudentLevel : nivel_atual
    Enrollment ||--o{ EnrollmentLevelPromotion : historicos
    Enrollment ||--o{ EnrollmentPromotionCertificate : certificados
    Enrollment ||--o{ EnrollmentTimelineEvent : eventos
    EnrollmentLevelPromotion }o--o| SchoolStudentLevel : from_level
    EnrollmentLevelPromotion }o--o| SchoolStudentLevel : to_level
    EnrollmentLevelPromotion ||--o| EnrollmentPromotionCertificate : opcional_um
    EnrollmentPromotionCertificate }o--|| SchoolCertificateTemplate : usa_modelo

    SchoolStudentLevel {
        char id PK
        char school_id FK
        varchar label
        varchar template_code_opcional
        int sort_order
    }

    SchoolCertificateTemplate {
        char id PK
        char school_id FK
        varchar name
        varchar logical_template_id
        json layout_config
    }

    Enrollment {
        char id PK
        char current_school_student_level_id FK_nullable
    }

    EnrollmentLevelPromotion {
        char id PK
        char enrollment_id FK
        char from_level_id FK_nullable
        char to_level_id FK_nullable
        varchar snapshots
        datetime promoted_at
    }

    EnrollmentPromotionCertificate {
        char id PK
        char enrollment_id FK
        char promotion_id FK_unico
        char certificate_template_id FK
    }

    EnrollmentTimelineEvent {
        char id PK
        char enrollment_id FK
        varchar event_type
        json payload
        datetime occurred_at
    }
```

Nota: no diagrama, `template_code` e `sort_order` são únicos **por escola** (restrições compostas no banco), não globalmente.

## Tabelas (MySQL)

| Tabela | Papel |
|--------|--------|
| `school_student_levels` | Catálogo de níveis da escola (`label`, `sort_order` único por escola; `template_code` opcional e único por escola quando preenchido). |
| `school_certificate_templates` | Vários modelos de certificado por escola: PK UUID (`id`) + `logical_template_id` único por escola; `layout_config` JSON para evolução de layout sem mudar schema. |
| `enrollments` | Coluna `current_school_student_level_id` (nullable): ponteiro rápido para o nível **atual somente nesta matrícula**. |
| `enrollment_level_promotions` | Histórico de cada promoção: `from_level_id` / `to_level_id` (opcionais se o catálogo for removido) + **snapshots** de rótulo e ordem. |
| `enrollment_promotion_certificates` | Certificado emitido; FKs obrigatórias à matrícula, à promoção e ao template. **Um certificado por promoção** (`UNIQUE promotion_id`). |
| `enrollment_timeline_events` | Linha do tempo genérica (`event_type` + `payload` JSON + `occurred_at`). |

Mapeamento ORM:

- [`school-student-level.orm.ts`](../src/infra/db/typeorm/entities/school-student-level.orm.ts)
- [`school-certificate-template.orm.ts`](../src/infra/db/typeorm/entities/school-certificate-template.orm.ts)
- [`enrollment.orm.ts`](../src/infra/db/typeorm/entities/enrollment.orm.ts) (campo `currentSchoolStudentLevelId`)
- [`enrollment-level-promotion.orm.ts`](../src/infra/db/typeorm/entities/enrollment-level-promotion.orm.ts)
- [`enrollment-promotion-certificate.orm.ts`](../src/infra/db/typeorm/entities/enrollment-promotion-certificate.orm.ts)
- [`enrollment-timeline-event.orm.ts`](../src/infra/db/typeorm/entities/enrollment-timeline-event.orm.ts)

Persistência no domínio (nível atual da matrícula ao salvar repositório): [`enrollment.ts`](../src/domain/entities/enrollment.ts).

## Foreign keys e políticas de exclusão

- **`enrollment_level_promotions`**, **`enrollment_promotion_certificates`** e **`enrollment_timeline_events`**: FK para **`enrollments(id)` com `ON DELETE RESTRICT`** — impedem apagar a linha da matrícula enquanto existirem registros ligados (histórico, certificado ou evento).
- **`enrollment_promotion_certificates`** → **`enrollment_level_promotions`**: `ON DELETE RESTRICT` (mantém integridade até haver política explícita de remoção em cascata no produto).
- **`enrollments.current_school_student_level_id`**: `ON DELETE SET NULL` sobre `school_student_levels` — se um nível do catálogo for removido, o ponteiro na matrícula zera sem apagar a matrícula.
- Promoções (`from_level_id` / `to_level_id`): `ON DELETE SET NULL` em relação ao catálogo, preservando snapshots de texto/ordem.
- **`school_student_levels`** e **`school_certificate_templates`**: FK para **`schools` com `ON DELETE CASCADE`** (segue o ciclo de vida da escola).

### Implicação operacional para desmatrícula

Fluxo esperado quando se quer **preservar histórico**: alterar apenas o **`status`** da matrícula (por exemplo para `CANCELLED` ou `COMPLETED`), **sem** executar `DELETE` em `enrollments`.

### Conflito com exclusão em cascata de turma para matrícula

Hoje existe relação de **`course_classes`** para **`enrollments`** com **`ON DELETE CASCADE`** no modelo já existente. Se houver registros nas novas tabelas ligados à matrícula, o **`RESTRICT`** nesses vínculos **impede** o MySQL de remover a linha de `enrollments`, o que pode fazer falhar uma tentativa de apagar fisicamente a turma (ou a hierarquia que dispara esse delete) até haver tratamento de dados derivados ou mudança de política explícita. Isso não afeta “desmatrícula por status”.

## Migrações

Use sempre os scripts do `package.json` (não invoque o CLI do TypeORM fora desses comandos):

- Desenvolvimento: `npm run migrate:run`
- Após build (produção): `npm run migrate:run:prod`

Arquivo que cria este schema: **`src/infra/db/typeorm/migrations/1000000000075-enrollment-levels-certificates-timeline.ts`**.