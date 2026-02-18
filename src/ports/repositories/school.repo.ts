import { School } from '../../domain/entities/school';

export type SchoolCityInfo = {
    schoolId: string;
    city: string | null;
};

export interface SchoolRepository {
    findById(id: string): Promise<School | null>;
    findByEmail?(email: string): Promise<School | null>;
    findByCnpj?(cnpj: string): Promise<School | null>;
    findByOwnerUserId?(userId: string): Promise<School | null>;
    findByOwnerEmail?(email: string): Promise<School | null>;
    findAll(): Promise<School[]>;
    save(school: School): Promise<void>;
    updateOwnerPassword?(schoolId: string, hashedPassword: string): Promise<void>;
    findCitiesBySchoolIds?(schoolIds: string[]): Promise<SchoolCityInfo[]>;
    /** Escolas com conta Asaas (account_api_key) mas ainda sem URL de onboarding. */
    findWithAccountKeyWithoutOnboardingUrl?(limit?: number): Promise<School[]>;
}
