import { SchoolRepository } from '../../ports/repositories/school.repo';
import { type PostalAddressProps } from '../../domain/value-objects/postal-address';
import { SchoolBankAccountRepository } from '../../ports/repositories/school-bank-account.repo';
import { SchoolImageRepository } from '../../ports/repositories/school-image.repo';
import { StorageProviderPort } from '../../ports/providers/storage-provider.port';
import { SchoolPlanFinanceRepository } from '../../ports/repositories/school-plan-finance.repo';
import { SchoolPlanInvoiceRepository } from '../../ports/repositories/school-plan-invoice.repo';
import { presentSchoolPlanFinance, SchoolPlanFinanceView } from '../presenters/school-plan-finance.presenter';

type BankAccountView = {
    id: string;
    bankName: string;
    bankCode?: number;
    bankAgency: string;
    bankAgencyDigit?: string;
    bankAccount: string;
    bankAccountDigit?: string;
    bankAccountType: 'CORRENTE' | 'POUPANCA';
    bankAccountHolderDocument: string;
    pixKey?: string;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
};

export class GetSchoolProfile {
    constructor(
        private readonly schools: SchoolRepository,
        private readonly bankAccounts?: SchoolBankAccountRepository,
        private readonly schoolImages?: SchoolImageRepository,
        private readonly storage?: StorageProviderPort,
        private readonly finances?: SchoolPlanFinanceRepository,
        private readonly invoices?: SchoolPlanInvoiceRepository
    ) {}

    async exec(input: { schoolId: string }): Promise<{
        id: string;
        name: string;
        email: string;
        phone: string;
        cnpj: string;
        addresses: PostalAddressProps[];
        createdAt: Date;
        ownerUserId: string | null;
        ownerName: string | null;
        ownerCpf: string | null;
        ownerEmail: string | null;
        incomeValue: number;
        bankAccounts: BankAccountView[];
        links: {
            facebook: string | null;
            instagram: string | null;
            tiktok: string | null;
            youtube: string | null;
            site: string | null;
        };
        images: Array<{
            id: string;
            url: string;
            key: string;
            contentType: string;
            originalFileName: string;
            category: string;
            createdAt: Date;
        }>;
        isOverdue?: boolean;
        onboardingCompleted: boolean;
        onboardingUrl?: string | null;
        plan?: SchoolPlanFinanceView | null;
    } | null> {
        const schoolId = input.schoolId.trim();
        if (!schoolId) return null;

        const school = await this.schools.findById(schoolId);
        if (!school) {
            return null;
        }

        const accounts = this.bankAccounts
            ? await this.bankAccounts.findBySchoolId(schoolId)
            : [];

        let images: Array<{
            id: string;
            url: string;
            key: string;
            contentType: string;
            originalFileName: string;
            category: string;
            createdAt: Date;
        }> = [];

        if (this.schoolImages && this.storage) {
            const schoolImages = await this.schoolImages.findBySchoolId(schoolId);
            images = await Promise.all(
                schoolImages.map(async (image) => {
                    try {
                        const url = await this.storage!.getFileUrl(image.key, 3600);
                        return {
                            id: image.id,
                            url,
                            key: image.key,
                            contentType: image.contentType,
                            originalFileName: image.originalFileName,
                            category: image.category,
                            createdAt: image.createdAt
                        };
                    } catch (error) {
                        console.warn(`Failed to generate signed URL for image key: ${image.key}`, error);
                        return {
                            id: image.id,
                            url: '',
                            key: image.key,
                            contentType: image.contentType,
                            originalFileName: image.originalFileName,
                            category: image.category,
                            createdAt: image.createdAt
                        };
                    }
                })
            );
        }

        let isOverdue = false;
        let plan: SchoolPlanFinanceView | null = null;

        if (this.finances && this.invoices) {
            const finance = await this.finances.findActiveBySchoolId(school.id);
            if (finance) {
                plan = presentSchoolPlanFinance(finance);
                
                const allInvoices = await this.invoices.findByFinanceId(finance.id);
                
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                
                for (const invoice of allInvoices) {
                    if (invoice.status !== 'PAID' && invoice.status !== 'CANCELLED') {
                        const dueDate = new Date(invoice.dueDate);
                        dueDate.setHours(0, 0, 0, 0);
                        
                        if (dueDate < today) {
                            isOverdue = true;
                            break;
                        }
                    }
                }
            }
        } else if (this.finances) {
            const finance = await this.finances.findActiveBySchoolId(school.id);
            if (finance) {
                plan = presentSchoolPlanFinance(finance);
            }
        }

        // Determinar se o onboarding foi finalizado
        // O onboarding está finalizado quando o webhook do Asaas confirma a aprovação da conta
        const onboardingCompleted = school.onboardingCompletedAt !== null;

        return {
            id: school.id,
            name: school.name,
            email: school.email,
            phone: school.phone,
            cnpj: school.cnpj,
            addresses: school.addresses.map((address) => address.toPrimitives()),
            createdAt: school.createdAt,
            ownerUserId: school.ownerUserId,
            ownerName: school.ownerName,
            ownerCpf: school.ownerCpf,
            ownerEmail: school.ownerEmail,
            incomeValue: school.incomeValue,
            bankAccounts: accounts.map((account) => ({
                id: account.id,
                bankName: account.bankName,
                bankCode: account.bankCode,
                bankAgency: account.bankAgency,
                bankAgencyDigit: account.bankAgencyDigit,
                bankAccount: account.bankAccount,
                bankAccountDigit: account.bankAccountDigit,
                bankAccountType: account.bankAccountType,
                bankAccountHolderDocument: account.bankAccountHolderDocument,
                pixKey: account.pixKey,
                isActive: account.isActive,
                createdAt: account.createdAt,
                updatedAt: account.updatedAt
            })),
            links: {
                facebook: school.facebookLink,
                instagram: school.instagramLink,
                tiktok: school.tiktokLink,
                youtube: school.youtubeLink,
                site: school.siteLink
            },
            images,
            isOverdue,
            onboardingCompleted,
            onboardingUrl: school.onboardingUrl,
            plan
        };
    }
}
