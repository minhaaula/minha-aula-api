import { JobExecutionLogRepository } from '../../../ports/repositories/job-execution-log.repo';
import { AppError } from '../../../shared/errors';
import { JobExecutionLogView, mapJobExecutionLogToView } from '../admin/list-admin-job-logs';

export class GetAdminJobLog {
    constructor(private readonly logs: JobExecutionLogRepository) {}

    async exec(input: { id: string }): Promise<JobExecutionLogView> {
        const id = input.id.trim();
        const row = await this.logs.findById(id);
        if (!row) {
            throw AppError.notFound('Registro de job', { id });
        }
        return mapJobExecutionLogToView(row);
    }
}
