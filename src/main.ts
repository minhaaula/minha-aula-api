import 'dotenv/config';
import { createServerForModules, type ModuleName } from './bootstrap/modules';

function parseModules(value: string | undefined): ModuleName[] {
    if (!value) return [];
    if (value === '*' || value.toLowerCase() === 'all') return [];

    const modules = value
        .split(',')
        .map((module) => module.trim().toLowerCase());

    if (modules.includes('all') || modules.includes('*')) {
        return [];
    }

    return modules.filter((module): module is ModuleName => ['auth', 'admin', 'payments', 'schools', 'students'].includes(module as ModuleName));
}

(async () => {
    const modules = parseModules(process.env.APP_MODULES);
    const { app, modules: activeModules } = await createServerForModules(modules);
    const port = Number(process.env.PORT ?? 3000);
    app.listen(port, () => {
        const label = activeModules.length > 0 ? activeModules.join(', ') : 'auth, payments, schools, students';
        console.log(`API (${label}) on http://localhost:${port}`);
    });
})();
