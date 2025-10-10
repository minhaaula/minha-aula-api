import { SubscriptionPlan } from '../../domain/entities/subscription-plan';

export interface SubscriptionPlanRepository {
    findActive(): Promise<SubscriptionPlan[]>;
    findById(id: string): Promise<SubscriptionPlan | null>;
}

