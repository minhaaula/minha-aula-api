import 'dotenv/config';
import { startWorker } from './worker-manager';

// Script standalone para iniciar o worker
// Se executado diretamente, inicia o worker
if (require.main === module) {
    try {
        startWorker();
        console.log('[Worker] Worker iniciado. Pressione Ctrl+C para parar.');
        
        // Manter o processo vivo
        process.on('SIGINT', async () => {
            console.log('\n[Worker] Recebido SIGINT, parando worker...');
            const { stopWorker } = await import('./worker-manager.js');
            await stopWorker();
            process.exit(0);
        });
        
        process.on('SIGTERM', async () => {
            console.log('\n[Worker] Recebido SIGTERM, parando worker...');
            const { stopWorker } = await import('./worker-manager.js');
            await stopWorker();
            process.exit(0);
        });
    } catch (error) {
        console.error('[Worker] Erro ao iniciar worker:', error);
        process.exit(1);
    }
}
