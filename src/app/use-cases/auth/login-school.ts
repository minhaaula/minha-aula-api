import { SchoolRepository } from '../../../ports/repositories/school.repo';
import { SchoolPlanFinanceRepository } from '../../../ports/repositories/school-plan-finance.repo';
import { SchoolPlanInvoiceRepository } from '../../../ports/repositories/school-plan-invoice.repo';
import { PasswordHasherPort } from '../../../ports/providers/password-hasher.port';
import { TokenProviderPort } from '../../../ports/providers/token-provider.port';
import { AuthTokenPayload } from '../../contracts/auth-token-payload';
import { UserPersonaEnum } from '../../../domain/value-objects/user-persona';
import { AppError, ErrorCode } from '../../../shared/errors';
import { presentSchoolPlanFinance, SchoolPlanFinanceView } from '../../presenters/school-plan-finance.presenter';

export class LoginSchool {
    constructor(
        private readonly schools: SchoolRepository,
        private readonly hasher: PasswordHasherPort,
        private readonly tokens: TokenProviderPort,
        private readonly defaultTtl: number,
        private readonly finances?: SchoolPlanFinanceRepository,
        private readonly invoices?: SchoolPlanInvoiceRepository
    ) {}

    async exec(input: { email: string; password: string; }): Promise<{
        accessToken: string;
        schoolId: string;
        ownerName: string;
        ownerEmail: string;
        expiresIn: number;
        status?: string;
        isOverdue?: boolean;
        onboardingCompleted: boolean;
        onboardingUrl?: string | null;
        hasCompletedFirstPayment: boolean;
        accountId: string | null;
        plan?: SchoolPlanFinanceView | null;
    }> {
        const email = this.normalizeEmail(input.email);
        const school = await this.findSchoolByOwnerEmail(email);

        if (!school?.ownerPasswordHash) {
            throw AppError.fromCode(ErrorCode.INVALID_CREDENTIALS);
        }

        const passwordMatches = await this.hasher.compare(input.password, school.ownerPasswordHash);
        if (!passwordMatches) {
            throw AppError.fromCode(ErrorCode.INVALID_CREDENTIALS);
        }

        const ownerCpf = school.ownerCpf;
        if (!ownerCpf) {
            throw AppError.fromCode(ErrorCode.INVALID_CREDENTIALS);
        }

        const ownerName = school.ownerName ?? school.name;
        const ownerEmail = school.ownerEmail ?? email;
        const expiresIn = this.defaultTtl;

        const payload: AuthTokenPayload = {
            sub: school.ownerUserId ?? school.id,
            persona: UserPersonaEnum.SCHOOL,
            email: ownerEmail,
            fullName: ownerName,
            cpf: ownerCpf,
            schoolId: school.id
        };

        const accessToken = await this.tokens.sign(payload, { expiresIn });

        // Verificar se a escola está atrasada
        let status: string | undefined;
        let isOverdue = false;

        if (this.finances && this.invoices) {
            const finance = await this.finances.findActiveBySchoolId(school.id);
            if (finance) {
                status = finance.status;
                
                // Buscar todas as invoices do finance
                const allInvoices = await this.invoices.findByFinanceId(finance.id);
                
                // Verificar se há alguma invoice não paga e atrasada
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                
                for (const invoice of allInvoices) {
                    // Verificar se a invoice não está paga e não está cancelada
                    if (invoice.status !== 'PAID' && invoice.status !== 'CANCELLED') {
                        const dueDate = new Date(invoice.dueDate);
                        dueDate.setHours(0, 0, 0, 0);
                        
                        // Se a data de vencimento é anterior a hoje, está atrasada
                        if (dueDate < today) {
                            isOverdue = true;
                            break;
                        }
                    }
                }
            }
        }

        // Determinar se o onboarding foi finalizado
        // O onboarding está finalizado quando o webhook do Asaas confirma a aprovação da conta
        const onboardingCompleted = school.onboardingCompletedAt !== null;
        
        // Se o onboarding não foi finalizado, retornar o link de onboarding
        const onboardingUrl = onboardingCompleted ? null : school.onboardingUrl;

        // Buscar plano ativo da escola
        let plan: SchoolPlanFinanceView | null = null;
        if (this.finances) {
            const finance = await this.finances.findActiveBySchoolId(school.id);
            if (finance) {
                plan = presentSchoolPlanFinance(finance);
            }
        }

        const hasCompletedFirstPayment = this.invoices
            ? await this.invoices.hasSchoolAnyPaidInvoice(school.id)
            : false;

        return {
            accessToken,
            schoolId: school.id,
            ownerName,
            ownerEmail,
            expiresIn,
            status,
            isOverdue,
            onboardingCompleted,
            onboardingUrl,
            hasCompletedFirstPayment,
            accountId: school.accountId,
            plan
        };
    }

    private normalizeEmail(value: string): string {
        const normalized = value.trim().toLowerCase();
        if (!normalized) {
            throw new Error('Invalid credentials');
        }
        return normalized;
    }

    private async findSchoolByOwnerEmail(email: string) {
        // Primeiro tenta buscar pelo email do owner
        if (this.schools.findByOwnerEmail) {
            const school = await this.schools.findByOwnerEmail(email);
            if (school) {
                return school;
            }
        }
        
        // Se não encontrou, tenta buscar pelo email da escola
        if (this.schools.findByEmail) {
            return this.schools.findByEmail(email);
        }
        
        return null;
    }
}
