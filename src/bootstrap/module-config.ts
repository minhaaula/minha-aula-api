export type ModuleName = 'auth' | 'payments' | 'schools' | 'students';

export const MODULES_ORDER: ModuleName[] = ['auth', 'payments', 'schools', 'students'];

export const MODULE_DOC_FILES: Record<ModuleName, string[]> = {
    auth: ['auth.yaml'],
    payments: ['payments.yaml'],
    schools: ['schools.yaml'],
    students: ['students.yaml', 'dependents.yaml', 'enrollment-requests.yaml']
};

export const BASE_DOC_FILES = ['health.yaml'];
