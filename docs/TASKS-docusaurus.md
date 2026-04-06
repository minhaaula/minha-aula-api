# Tasks — Docusaurus + documentação por módulo

**Status:** implementado na base do repositório (`website/`, rota Express `/portal`). Ajuste fino e CI ficam como melhorias.

---

## Épico A — Módulo / pipeline que “carrega” o Docusaurus

- [x] **A1 — Pasta do site** — `website/` na raiz do repositório.
- [x] **A2 — Scaffold Docusaurus** — template classic TypeScript.
- [x] **A3 — Build** — `npm run build` em `website/` → `website/build/`.
- [x] **A4 — Integração Express** — `GET /portal` serve `express.static` em `website/build` (ou `PORTAL_STATIC_DIR`).
- [ ] **A5 — CI** — incluir `npm run portal:build` no pipeline de deploy (opcional).
- [x] **A6 — Link Swagger** — navbar/footer e home apontam para `pathname:///docs` e OpenAPI JSON (mesma origem da API).

---

## Épico B — Configurar docs dos módulos no Docusaurus

- [x] **B1 — Sidebar** — `website/sidebars.ts` (`docsSidebar`: intro, módulos, referência).
- [x] **B2 — Pastas** — `website/docs/modules/*.md`, `website/docs/reference/openapi.md`.
- [x] **B3 — Mapa OpenAPI** — tabela em `reference/openapi.md` + `MODULE_DOC_FILES` no código.
- [ ] **B4 — Plugin OpenAPI no Docusaurus** — não necessário; Swagger em `/docs`.
- [ ] **B5 — Versionamento** — opcional.
- [ ] **B6 — Search local** — opcional (`@easyops-cn/docusaurus-search-local`).

---

## Épico C — Documentar todos os módulos (conteúdo)

- [x] **C0** — Introdução com personas e `APP_MODULES` (`docs/intro.md`).
- [x] **C1 — Auth** — `docs/modules/auth.md`.
- [x] **C2 — Admin** — `docs/modules/admin.md`.
- [x] **C3 — Payments** — `docs/modules/payments.md`.
- [x] **C4 — Schools** — `docs/modules/schools.md`.
- [x] **C5 — Students** — `docs/modules/students.md`.
- [x] **C6 — Referência OpenAPI** — `docs/reference/openapi.md`.
- [ ] **C7 — Diagramas Mermaid** — opcional.

---

## Scripts na raiz

- `npm run portal:build` — build do portal.
- `npm run portal:dev` — dev server Docusaurus.
- `npm run portal:start` — serve build estático.

---

## Critérios de pronto (mínimo)

- [x] Build Docusaurus sem erros; rota `/portal` na API quando `website/build` existe.
- [x] Sidebar com módulos + referência Swagger.
- [x] Uma página por módulo com visão funcional e link aos YAML.
