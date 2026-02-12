import { SubscriptionPlan } from '../../domain/entities/subscription-plan';

export interface SubscriptionPlanRepository {
    findActive(): Promise<SubscriptionPlan[]>;
    findAll(): Promise<SubscriptionPlan[]>;
    findById(id: string): Promise<SubscriptionPlan | null>;
    findByCode(code: string): Promise<SubscriptionPlan | null>;
    save(plan: SubscriptionPlan): Promise<void>;
}

