import 'dotenv/config';
import { AppDataSource } from '../db/typeorm/datasource';
import { EnrollmentRepositoryAdapter } from '../db/typeorm/enrollment-repository';
import { SchoolFinancialChargeRepositoryAdapter } from '../db/typeorm/school-financial-charge-repository.adapter';
import { CourseRepositoryAdapter } from '../db/typeorm/course-repository';
import { CourseClassRepositoryAdapter } from '../db/typeorm/course-class-repository.adapter';
import { GenerateMonthlyTuitionCharges } from '../../app/use-cases/generate-monthly-tuition-charges';
import { log } from '../../shared/logger';

async function main() {
    try {
        log.info('[Cron] Iniciando geração de cobranças mensais');

        // Inicializar conexão com banco de dados
        if (!AppDataSource.isInitialized) {
            await AppDataSource.initialize();
            log.info('[Cron] Conexão com banco de dados estabelecida');
        }

        // Criar repositórios
        const enrollments = new EnrollmentRepositoryAdapter();
        const charges = new SchoolFinancialChargeRepositoryAdapter();
        const courses = new CourseRepositoryAdapter();
        const classes = new CourseClassRepositoryAdapter();

        // Criar use case
        const generateCharges = new GenerateMonthlyTuitionCharges(
            enrollments,
            charges,
            courses,
            classes
        );

        // Executar geração de cobranças
        const result = await generateCharges.exec();

        log.info('[Cron] Geração de cobranças concluída', {
            generated: result.generated,
            skipped: result.skipped,
            errors: result.errors
        });

        // Log de detalhes dos skips
        if (result.skipped > 0) {
            const skipped = result.details.filter((d) => d.status === 'skipped');
            const skipReasons = skipped.reduce((acc, item) => {
                const reason = item.reason || 'Motivo não especificado';
                acc[reason] = (acc[reason] || 0) + 1;
                return acc;
            }, {} as Record<string, number>);
            
            log.info('[Cron] Motivos de skip encontrados', {
                reasons: skipReasons,
                total: result.skipped
            });

            // Log dos primeiros 5 skips como exemplo
            if (skipped.length > 0) {
                log.info('[Cron] Exemplos de skips (primeiros 5)', {
                    examples: skipped.slice(0, 5).map((s) => ({
                        enrollmentId: s.enrollmentId,
                        courseName: s.courseName,
                        reason: s.reason
                    }))
                });
            }
        }

        // Log de detalhes se houver erros
        if (result.errors > 0) {
            const errors = result.details.filter((d) => d.status === 'error');
            log.error('[Cron] Erros encontrados durante a geração', {
                errors: errors.slice(0, 10) // Limitar a 10 erros no log
            });
        }

        process.exit(0);
    } catch (error) {
        log.error('[Cron] Erro fatal ao gerar cobranças mensais', {
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined
        });
        process.exit(1);
    }
}

// Executar apenas se chamado diretamente
if (require.main === module) {
    main();
}

