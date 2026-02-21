import { AppDataSource } from './datasource';
import type {
    ChargeDueReminderRepository,
    ChargeDueReminderType
} from '../../../ports/repositories/charge-due-reminder.repo';
import { ChargeDueReminderOrm } from './entities/charge-due-reminder.orm';
import { Uuid } from '../../../shared/uuid';

export class ChargeDueReminderRepositoryAdapter implements ChargeDueReminderRepository {
    private readonly repo = AppDataSource.getRepository(ChargeDueReminderOrm);

    async wasReminderSent(chargeType: ChargeDueReminderType, chargeId: string): Promise<boolean> {
        const count = await this.repo.count({
            where: { chargeType, chargeId }
        });
        return count > 0;
    }

    async markReminderSent(chargeType: ChargeDueReminderType, chargeId: string): Promise<void> {
        await this.repo.save({
            id: Uuid(),
            chargeType,
            chargeId
        });
    }
}
