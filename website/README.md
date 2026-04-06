# Portal de documentação (Docusaurus)

Documentação funcional da API Minha Aula (Markdown). O **playground** OpenAPI continua em `/docs` (Swagger UI na mesma API).

## Comandos

| Comando | Descrição |
|---------|-----------|
| `npm run start` | Dev server (baseUrl `/portal/`) |
| `npm run build` | Gera `build/` para produção |
| `npm run serve` | Serve o `build/` localmente |

Na raiz do repositório:

- `npm run portal:routes:gen` — regenera `website/docs/modules/routes/*.md` a partir de `docs/*.yaml`
- `npm run portal:build`, `npm run portal:dev`, `npm run portal:start`

## Produção

1. `npm run portal:build` (ou `cd website && npm run build`).
2. Subir a API; com `website/build` presente no working directory, a rota **`/portal`** serve o site estático.
3. Variável opcional: **`PORTAL_STATIC_DIR`** — caminho absoluto para a pasta do build se não for `./website/build`.

Swagger: **`/docs`**. Portal: **`/portal`**.
