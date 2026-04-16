import fs from 'fs';
import path from 'path';
import YAML from 'yaml';

// Caminhos candidatos para encontrar o diretório docs
// Funciona tanto em dev (tsx) quanto em produção (node dist/main.js)
const DOCS_DIR_CANDIDATES = [
    path.resolve(process.cwd(), 'docs'),
    path.resolve(process.cwd(), 'dist/docs'),
    // @ts-ignore - __dirname está disponível em CommonJS (código compilado)
    typeof __dirname !== 'undefined' ? path.resolve(__dirname, '../../../docs') : null,
    // @ts-ignore
    typeof __dirname !== 'undefined' ? path.resolve(__dirname, '../../../../docs') : null
].filter((dir): dir is string => dir !== null) as string[];
const BASE_FILENAMES = ['openapi.yaml', 'openapi.yml'];

type PlainObject = Record<string, unknown>;

function isPlainObject(value: unknown): value is PlainObject {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function deepMerge(target: any, source: any): any {
    if (!isPlainObject(target) || !isPlainObject(source)) {
        return source;
    }

    const result: PlainObject = { ...target };

    for (const [key, value] of Object.entries(source)) {
        const existing = (target as PlainObject)[key];
        if (isPlainObject(existing) && isPlainObject(value)) {
            result[key] = deepMerge(existing, value);
        } else {
            result[key] = value;
        }
    }

    return result;
}

function parseYamlFile(filePath: string) {
    const raw = fs.readFileSync(filePath, 'utf8');
    return YAML.parse(raw) ?? {};
}

function normalizeServerUrl(url: string | undefined): string | undefined {
    if (!url) return undefined;
    const trimmed = url.trim();
    if (!trimmed) return undefined;
    if (/^https?:\/\//i.test(trimmed)) {
        return trimmed;
    }
    return `https://${trimmed}`;
}

type LoadOptions = {
    includeFiles?: string[];
    modules?: Array<string>;
};

type OpenApiOperation = Record<string, unknown> & {
    tags?: string[];
};

function titleizeSegment(segment: string): string {
    const cleaned = segment
        .replace(/^\{|\}$/g, '')
        .replace(/[-_]+/g, ' ')
        .trim();
    if (!cleaned) return segment;
    return cleaned
        .split(' ')
        .filter(Boolean)
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
}

function computeHierarchicalTag(baseTag: string, rawPath: string): string {
    const segments = rawPath.split('/').filter(Boolean);
    const second = segments[1] ?? '';
    const third = segments[2] ?? '';

    // Casos especiais: rotas de autenticação da escola vivem em /schools/*
    if (baseTag === 'Schools' && (second === 'login' || second === 'password')) {
        if (second === 'login') {
            return 'Schools / Auth / Login';
        }
        const passwordSuffix = third ? ` / ${titleizeSegment(third)}` : '';
        return `Schools / Auth / Password${passwordSuffix}`;
    }

    if (baseTag === 'Auth') {
        if (second === 'login') return 'Auth / Login';
        if (second === 'register') return 'Auth / Cadastro';
        if (second === 'refresh') return 'Auth / Tokens';
        if (second === 'password') {
            const passwordSuffix = third ? ` / ${titleizeSegment(third)}` : '';
            return `Auth / Senha${passwordSuffix}`;
        }
    }

    const category = second ? titleizeSegment(second) : baseTag;
    const subcategory = third ? ` / ${titleizeSegment(third)}` : '';
    return `${baseTag} / ${category}${subcategory}`;
}

function ensureTagEntry(document: any, tagName: string) {
    if (!Array.isArray(document.tags)) {
        document.tags = [];
    }
    const tags = document.tags as Array<{ name?: string; description?: string }>;
    if (!tags.some((t) => t?.name === tagName)) {
        tags.push({ name: tagName });
    }
}

function applyHierarchicalTags(document: any) {
    if (!document || typeof document !== 'object') return;
    const paths = (document as any).paths;
    if (!paths || typeof paths !== 'object') return;

    for (const [rawPath, pathItem] of Object.entries(paths as Record<string, unknown>)) {
        if (!pathItem || typeof pathItem !== 'object') continue;

        for (const [method, operation] of Object.entries(pathItem as Record<string, unknown>)) {
            // Ignorar chaves não-operacionais (ex.: parameters)
            if (!['get', 'post', 'put', 'patch', 'delete', 'options', 'head'].includes(method)) continue;
            if (!operation || typeof operation !== 'object') continue;

            const op = operation as OpenApiOperation;
            if (!Array.isArray(op.tags) || op.tags.length === 0) continue;

            const baseTag = op.tags[0] ?? '';
            if (!baseTag) continue;

            const hierarchical = computeHierarchicalTag(baseTag, rawPath);
            op.tags = [hierarchical];
            ensureTagEntry(document, hierarchical);
        }
    }

    // Ordenação estável: deixa o Swagger UI previsível
    if (Array.isArray(document.tags)) {
        document.tags = [...document.tags].sort((a: any, b: any) => {
            const an = typeof a?.name === 'string' ? a.name : '';
            const bn = typeof b?.name === 'string' ? b.name : '';
            return an.localeCompare(bn, 'pt-BR');
        });
    }
}

export function loadOpenApiDocument(options?: LoadOptions) {
    const docsDir = DOCS_DIR_CANDIDATES.find((dir) => fs.existsSync(dir));
    if (!docsDir) {
        throw new Error(`Diretório de documentação não encontrado. Caminhos verificados: ${DOCS_DIR_CANDIDATES.join(', ')}`);
    }

    const filenames = fs.readdirSync(docsDir)
        .filter((file) => file.endsWith('.yaml') || file.endsWith('.yml'));

    if (filenames.length === 0) {
        throw new Error('Nenhum arquivo YAML encontrado em docs/');
    }

    const baseFile = BASE_FILENAMES.find((name) => filenames.includes(name)) ?? filenames[0];
    let document = parseYamlFile(path.join(docsDir, baseFile));

    const allowed = options?.includeFiles ? new Set(options.includeFiles) : null;

    const otherFiles = filenames
        .filter((file) => file !== baseFile)
        .filter((file) => !allowed || allowed.has(file))
        .sort();

    for (const file of otherFiles) {
        const partialDoc = parseYamlFile(path.join(docsDir, file));
        document = deepMerge(document, partialDoc);
    }

    const prodUrl = normalizeServerUrl(process.env.SWAGGER_PROD_URL ?? process.env.API_PROD_URL);
    if (prodUrl) {
        if (!Array.isArray(document.servers)) {
            document.servers = [];
        }
        const servers = document.servers as Array<{ url?: string; description?: string }>;
        const prodServer = servers.find((server) => typeof server.description === 'string' && /prod/i.test(server.description));
        if (prodServer) {
            prodServer.url = prodUrl;
        } else {
            servers.push({ url: prodUrl, description: 'Ambiente Prod' });
        }
    }

    applyHierarchicalTags(document);

    return document;
}
