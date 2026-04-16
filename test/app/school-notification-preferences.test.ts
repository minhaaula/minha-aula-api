import { describe, expect, it } from 'vitest';
import { School } from '../../src/domain/entities/school';
import { PostalAddress } from '../../src/domain/value-objects/postal-address';
import type { SchoolRepository } from '../../src/ports/repositories/school.repo';
import { GetSchoolNotificationPreferences } from '../../src/app/use-cases/get-school-notification-preferences';
import { UpdateSchoolNotificationPreferences } from '../../src/app/use-cases/update-school-notification-preferences';

class InMemorySchoolRepository implements SchoolRepository {
    private readonly items = new Map<string, School>();
    async findById(id: string): Promise<School | null> {
        return this.items.get(id) ?? null;
    }
    async findAll(): Promise<School[]> {
        return [...this.items.values()];
    }
    async save(school: School): Promise<void> {
        this.items.set(school.id, school);
    }
    seed(school: School) {
        this.items.set(school.id, school);
    }
}

function makeSchool(params?: Partial<{ emailEnabled: boolean; whatsappEnabled: boolean; pushEnabled: boolean }>) {
    return School.create({
        id: '550e8400-e29b-41d4-a716-446655440000',
        name: 'Escola Teste',
        email: 'escola@teste.com',
        phone: '11999999999',
        cnpj: '11222333000199',
        addresses: [
            PostalAddress.create({
                street: 'Rua A',
                number: '123',
                city: 'São Paulo',
                state: 'SP',
                zipCode: '01001000',
                complement: null,
                district: null
            })
        ],
        notificationsEmailEnabled: params?.emailEnabled,
        notificationsWhatsappEnabled: params?.whatsappEnabled,
        notificationsPushEnabled: params?.pushEnabled
    });
}

describe('School.create — preferências (coerção DB)', () => {
    it('aceita tinyint MySQL como 0/1 (number)', () => {
        const school = School.create({
            id: '550e8400-e29b-41d4-a716-446655440000',
            name: 'Escola Teste',
            email: 'escola@teste.com',
            phone: '11999999999',
            cnpj: '11222333000199',
            notificationsEmailEnabled: 1,
            notificationsWhatsappEnabled: 0,
            notificationsPushEnabled: 1
        } as Parameters<typeof School.create>[0]);

        expect(school.notificationsEmailEnabled).toBe(true);
        expect(school.notificationsWhatsappEnabled).toBe(false);
        expect(school.notificationsPushEnabled).toBe(true);
    });
});

describe('School notification preferences (use-cases)', () => {
    it('defaults to true when not provided', async () => {
        const repo = new InMemorySchoolRepository();
        repo.seed(makeSchool());

        const get = new GetSchoolNotificationPreferences(repo);
        const prefs = await get.exec({ schoolId: '550e8400-e29b-41d4-a716-446655440000' });

        expect(prefs).toEqual({
            emailEnabled: true,
            whatsappEnabled: true,
            pushEnabled: true
        });
    });

    it('updates partially and persists', async () => {
        const repo = new InMemorySchoolRepository();
        repo.seed(makeSchool({ emailEnabled: true, whatsappEnabled: true, pushEnabled: true }));

        const update = new UpdateSchoolNotificationPreferences(repo);
        await update.exec({
            schoolId: '550e8400-e29b-41d4-a716-446655440000',
            pushEnabled: false
        });

        const get = new GetSchoolNotificationPreferences(repo);
        const prefs = await get.exec({ schoolId: '550e8400-e29b-41d4-a716-446655440000' });

        expect(prefs).toEqual({
            emailEnabled: true,
            whatsappEnabled: true,
            pushEnabled: false
        });
    });
});

