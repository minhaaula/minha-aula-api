import { AppDataSource } from './datasource';
import { SchoolRepository } from '../../../ports/repositories/school.repo';
import { School } from '../../../domain/entities/school';
import { SchoolOrm } from './entities/school.orm';
import { PostalAddress } from '../../../domain/value-objects/postal-address';
import { SchoolAddressOrm } from './entities/school-address.orm';
import { Uuid } from '../../../shared/uuid';
import { SchoolCategoryOrm } from './entities/school-category.orm';
import { SchoolCategorySubcategoryOrm } from './entities/school-subcategory.orm';
import { CategoryOrm } from './entities/category.orm';
import { SubcategoryOrm } from './entities/subcategory.orm';
import { In } from 'typeorm';

export class SchoolRepositoryAdapter implements SchoolRepository {
    private readonly repo = AppDataSource.getRepository(SchoolOrm);
    private readonly categoriesRepo = AppDataSource.getRepository(CategoryOrm);
    private readonly subcategoriesRepo = AppDataSource.getRepository(SubcategoryOrm);

    async findById(id: string): Promise<School | null> {
        const row = await this.repo.findOne({
            where: { id },
            relations: {
                addresses: true,
                categories: {
                    category: true,
                    subcategories: { subcategory: { category: true } }
                }
            }
        });
        return row ? this.toDomain(row) : null;
    }

    async findByEmail(email: string): Promise<School | null> {
        const normalized = email.trim().toLowerCase();
        if (!normalized) return null;
        const row = await this.repo.findOne({
            where: { email: normalized },
            relations: {
                addresses: true,
                categories: {
                    category: true,
                    subcategories: { subcategory: { category: true } }
                }
            }
        });
        return row ? this.toDomain(row) : null;
    }

    async findByOwnerUserId(userId: string): Promise<School | null> {
        const normalized = userId.trim();
        if (!normalized) return null;
        const row = await this.repo.findOne({
            where: { ownerUserId: normalized },
            relations: {
                addresses: true,
                categories: {
                    category: true,
                    subcategories: { subcategory: { category: true } }
                }
            }
        });
        return row ? this.toDomain(row) : null;
    }

    async findAll(): Promise<School[]> {
        const rows = await this.repo.find({
            relations: {
                addresses: true,
                categories: {
                    category: true,
                    subcategories: { subcategory: { category: true } }
                }
            },
            order: { createdAt: 'DESC' }
        });
        return rows.map((row) => this.toDomain(row));
    }

    async save(school: School): Promise<void> {
        const row = await this.toOrm(school);
        await this.repo.save(row);
    }

    private toDomain(row: SchoolOrm): School {
        const addresses = (row.addresses ?? []).map((address) => PostalAddress.create({
            street: address.street,
            number: address.number,
            complement: address.complement,
            district: address.district,
            city: address.city,
            state: address.state,
            zipCode: address.zipCode
        }));

        const categories = Array.isArray(row.categories)
            ? row.categories.map((link) => ({
                categoryId: link.categoryId,
                subcategoryIds: Array.isArray(link.subcategories)
                    ? link.subcategories.map((subLink) => subLink.subcategoryId)
                    : []
            }))
            : [];

        return School.create({
            id: row.id,
            name: row.name,
            addresses,
            createdAt: row.createdAt,
            email: row.email,
            phone: row.phone,
            cnpj: row.cnpj,
            ownerUserId: row.ownerUserId ?? null,
            categories
        });
    }

    private async toOrm(school: School): Promise<SchoolOrm> {
        const row = new SchoolOrm();
        row.id = school.id;
        row.name = school.name;
        row.createdAt = school.createdAt;
        row.email = school.email;
        row.phone = school.phone;
        row.cnpj = school.cnpj;
        row.ownerUserId = school.ownerUserId;
        row.categories = await this.createCategoryLinks(row, school.categories);
        row.addresses = school.addresses.map((address) => {
            const item = new SchoolAddressOrm();
            item.id = Uuid();
            item.street = address.street;
            item.number = address.number;
            item.complement = address.complement;
            item.district = address.district;
            item.city = address.city;
            item.state = address.state;
            item.zipCode = address.zipCode;
            item.school = row;
            return item;
        });
        return row;
    }

    private async createCategoryLinks(
        school: SchoolOrm,
        categories: Array<{ categoryId: string; subcategoryIds: string[] }>
    ): Promise<SchoolCategoryOrm[]> {
        if (!categories.length) return [];

        const uniqueCategoryIds = Array.from(new Set(categories.map((item) => item.categoryId)));
        const categoryRows = await this.categoriesRepo.findBy({ id: In(uniqueCategoryIds) });
        const categoryMap = new Map(categoryRows.map((row) => [row.id, row]));

        if (categoryMap.size !== uniqueCategoryIds.length) {
            const missing = uniqueCategoryIds.filter((id) => !categoryMap.has(id));
            throw new Error(`Unknown categories: ${missing.join(', ')}`);
        }

        const links: SchoolCategoryOrm[] = [];

        for (const categoryData of categories) {
            const category = categoryMap.get(categoryData.categoryId)!;
            const link = new SchoolCategoryOrm();
            link.id = Uuid();
            link.school = school;
            link.schoolId = school.id;
            link.category = category;
            link.categoryId = category.id;
            link.subcategories = await this.createSubcategoryLinks(link, category, categoryData.subcategoryIds);
            links.push(link);
        }

        return links;
    }

    private async createSubcategoryLinks(
        schoolCategory: SchoolCategoryOrm,
        category: CategoryOrm,
        subcategoryIds: string[]
    ): Promise<SchoolCategorySubcategoryOrm[]> {
        if (!subcategoryIds.length) return [];

        const uniqueIds = Array.from(new Set(subcategoryIds));
        const subcategoryRows = await this.subcategoriesRepo.findBy({ id: In(uniqueIds) });
        const subcategoryMap = new Map(subcategoryRows.map((row) => [row.id, row]));

        const missing = uniqueIds.filter((id) => !subcategoryMap.has(id));
        if (missing.length > 0) {
            throw new Error(`Unknown subcategories: ${missing.join(', ')}`);
        }

        for (const row of subcategoryRows) {
            if (row.categoryId !== category.id) {
                throw new Error(`Subcategory ${row.id} does not belong to category ${category.id}`);
            }
        }

        return uniqueIds.map((id) => {
            const subcategory = subcategoryMap.get(id)!;
            const link = new SchoolCategorySubcategoryOrm();
            link.id = Uuid();
            link.schoolCategory = schoolCategory;
            link.schoolCategoryId = schoolCategory.id;
            link.subcategory = subcategory;
            link.subcategoryId = subcategory.id;
            return link;
        });
    }
}
