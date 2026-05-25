# Use cases

Cada subpasta agrupa casos de uso por domínio (alinhado aos módulos HTTP/bootstrap).

| Pasta | Responsabilidade |
|-------|------------------|
| `auth/` | Login, cadastro de usuário, refresh, senha, OTP de telefone |
| `admin/` | Painel administrativo (escolas, planos, categorias, cupons, jobs) |
| `schools/` | Operação da escola (perfil, financeiro, Asaas, turmas/alunos da escola, cobranças) |
| `students/` | App do aluno (perfil, dependentes, meus cursos, pagamentos do aluno) |
| `enrollments/` | Matrículas, solicitações, timeline, níveis e certificados |
| `courses/` | Cursos, turmas e sessões de aula |
| `payments/` | PIX, boleto, webhooks Asaas, geração de mensalidades |
| `catalog/` | Listagens públicas (categorias, planos de assinatura) |
| `shared/` | Helpers reutilizados entre pastas (ex.: `notify-student-user`, `student-summary`) |

Imports externos: `../../../ports`, `../../../domain`, `../../types`, `../../presenters`, etc.
