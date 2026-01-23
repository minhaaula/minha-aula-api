import 'dotenv/config';
import { createServerForModules, type ModuleName } from './bootstrap/modules';
import { log } from './shared/logger';

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
    
    const server = app.listen(port, () => {
        const label = activeModules.length > 0 ? activeModules.join(', ') : 'auth, payments, schools, students';
        console.log(`API (${label}) on http://localhost:${port}`);
    });

    // Configurar graceful shutdown
    const gracefulShutdown = async (signal: string) => {
        log.info(`[Server] Recebido ${signal}, iniciando shutdown gracioso...`);
        
        // Parar de aceitar novas conexões
        server.close(() => {
            log.info('[Server] Servidor HTTP fechado');
        });

        // Aguardar requisições em andamento terminarem (timeout de 10 segundos)
        const httpShutdownTimeout = setTimeout(() => {
            log.warn('[Server] Timeout ao aguardar requisições HTTP terminarem. Forçando fechamento...');
            process.exit(1);
        }, 10000);

        try {
            // Parar worker BullMQ (aguarda jobs terminarem)
            const { stopWorker } = await import('./infra/messaging/bullmq/worker-manager.js');
            await stopWorker(30000); // 30 segundos para jobs terminarem
            
            clearTimeout(httpShutdownTimeout);
            log.info('[Server] Shutdown gracioso concluído');
            process.exit(0);
        } catch (error) {
            clearTimeout(httpShutdownTimeout);
            log.error('[Server] Erro durante shutdown gracioso', {
                error: error instanceof Error ? error.message : String(error)
            });
            process.exit(1);
        }
    };

    // Registrar handlers de shutdown
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

    // Tratar erros não capturados
    process.on('uncaughtException', (error) => {
        log.error('[Server] Erro não capturado', { error: error.message, stack: error.stack });
        gracefulShutdown('uncaughtException').catch(() => process.exit(1));
    });

    process.on('unhandledRejection', (reason) => {
        log.error('[Server] Promise rejeitada não tratada', { reason });
        gracefulShutdown('unhandledRejection').catch(() => process.exit(1));
    });
})();
