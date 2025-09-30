import fs from 'fs';
import path from 'path';
import YAML from 'yaml';

const DOCS_DIR_CANDIDATES = [
    path.resolve(process.cwd(), 'docs'),
    path.resolve(__dirname, '../../../docs'),
    path.resolve(__dirname, '../../../../docs')
];
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

type LoadOptions = {
    includeFiles?: string[];
    modules?: Array<string>;
};

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

    const prodUrl = process.env.SWAGGER_PROD_URL ?? process.env.API_PROD_URL;
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

    return document;
}
