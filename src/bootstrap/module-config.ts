export type ModuleName = 'auth' | 'admin' | 'payments' | 'schools' | 'students';

export const MODULES_ORDER: ModuleName[] = ['auth', 'admin', 'payments', 'schools', 'students'];

/**
 * Arquivos OpenAPI (docs/*.yaml) mesclados no Swagger quando o módulo está ativo.
 * Deve refletir apenas rotas realmente expostas por esse módulo (evitar doc de outro app).
 * Fonte única: também importado em `build*Module` via `docFiles`.
 */
export const MODULE_DOC_FILES: Record<ModuleName, string[]> = {
    auth: ['auth.yaml'],
    admin: ['admin.yaml'],
    payments: ['payments.yaml'],
    schools: [
        'schools.yaml',
        'webhooks.yaml',
        'enrollment-requests.yaml',
        'landing.yaml'
    ],
    students: ['students.yaml', 'dependents.yaml', 'enrollment-requests.yaml', 'schools-public.yaml']
};

export const BASE_DOC_FILES = ['health.yaml'];
