import { SubscriptionPlan } from './subscription-plan';

export type SchoolPlanStatus = 'TRIAL' | 'ACTIVE' | 'PAST_DUE' | 'SUSPENDED' | 'CANCELLED';

const VALID_STATUSES: SchoolPlanStatus[] = ['TRIAL', 'ACTIVE', 'PAST_DUE', 'SUSPENDED', 'CANCELLED'];

export class SchoolPlanFinance {
    private constructor(
        public readonly id: string,
        public readonly schoolId: string,
        private readonly _plan: SubscriptionPlan,
        private readonly _status: SchoolPlanStatus,
        private readonly _isPaid: boolean,
        private readonly _lastPaymentAt: Date | null,
        private readonly _nextDueAt: Date | null,
        private readonly _notes: string | null,
        public readonly createdAt: Date,
        public readonly updatedAt: Date
    ) {}

    static create(params: {
        id: string;
        schoolId: string;
        plan: SubscriptionPlan;
        status?: SchoolPlanStatus;
        isPaid?: boolean;
        lastPaymentAt?: Date | null;
        nextDueAt?: Date | null;
        notes?: string | null;
        createdAt?: Date;
        updatedAt?: Date;
    }): SchoolPlanFinance {
        const id = params.id.trim();
        if (!id) throw new Error('School plan finance id is required');

        const schoolId = params.schoolId.trim();
        if (!schoolId) throw new Error('School plan finance school id is required');

        if (!(params.plan instanceof SubscriptionPlan)) {
            throw new Error('School plan finance requires a subscription plan');
        }

        const status = params.status ?? 'ACTIVE';
        if (!VALID_STATUSES.includes(status)) {
            throw new Error('School plan finance status is invalid');
        }

        const isPaid = params.isPaid ?? false;
        if (typeof isPaid !== 'boolean') {
            throw new Error('School plan finance payment flag must be a boolean');
        }

        const lastPaymentAt = params.lastPaymentAt ?? null;
        const nextDueAt = params.nextDueAt ?? null;
        const notes = params.notes?.trim() ?? null;
        const createdAt = params.createdAt ?? new Date();
        const updatedAt = params.updatedAt ?? createdAt;

        return new SchoolPlanFinance(
            id,
            schoolId,
            params.plan,
            status,
            isPaid,
            lastPaymentAt,
            nextDueAt,
            notes,
            createdAt,
            updatedAt
        );
    }

    get plan(): SubscriptionPlan {
        return this._plan;
    }

    get status(): SchoolPlanStatus {
        return this._status;
    }

    get isPaid(): boolean {
        return this._isPaid;
    }

    get lastPaymentAt(): Date | null {
        return this._lastPaymentAt;
    }

    get nextDueAt(): Date | null {
        return this._nextDueAt;
    }

    get notes(): string | null {
        return this._notes;
    }

    withChanges(changes: {
        status?: SchoolPlanStatus;
        isPaid?: boolean;
        lastPaymentAt?: Date | null;
        nextDueAt?: Date | null;
        notes?: string | null;
        updatedAt?: Date;
    }): SchoolPlanFinance {
        if (changes.status) {
            if (!VALID_STATUSES.includes(changes.status)) {
                throw new Error('School plan finance status is invalid');
            }
            // Validar transição de estado
            if (changes.status !== this._status) {
                const { validateFinanceStatusTransition, getFinanceTransitionError } = require('./state-transitions');
                if (!validateFinanceStatusTransition(this._status, changes.status)) {
                    throw new Error(getFinanceTransitionError(this._status, changes.status));
                }
            }
        }

        return SchoolPlanFinance.create({
            id: this.id,
            schoolId: this.schoolId,
            plan: this._plan,
            status: changes.status ?? this._status,
            isPaid: changes.isPaid ?? this._isPaid,
            lastPaymentAt: changes.lastPaymentAt === undefined ? this._lastPaymentAt : changes.lastPaymentAt,
            nextDueAt: changes.nextDueAt === undefined ? this._nextDueAt : changes.nextDueAt,
            notes: changes.notes === undefined ? this._notes : (changes.notes?.trim() ?? null),
            createdAt: this.createdAt,
            updatedAt: changes.updatedAt ?? new Date()
        });
    }
}
