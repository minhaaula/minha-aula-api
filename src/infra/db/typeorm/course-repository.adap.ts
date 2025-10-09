import { AppDataSource } from './datasource';
import { CourseRepository } from '../../../ports/repositories/course.repo';
import { Course } from '../../../domain/entities/course';
import { CourseOrm } from './entities/course.orm';
import { CourseCategoryOrm } from './entities/course-category.orm';
import { CourseCategorySubcategoryOrm } from './entities/course-category-subcategory.orm';
import { CategoryOrm } from './entities/category.orm';
import { SubcategoryOrm } from './entities/subcategory.orm';
import { In } from 'typeorm';
import { Uuid } from '../../../shared/uuid';

export class CourseRepositoryAdapter implements CourseRepository {
    private readonly repo = AppDataSource.getRepository(CourseOrm);
    private readonly categoriesRepo = AppDataSource.getRepository(CategoryOrm);
    private readonly subcategoriesRepo = AppDataSource.getRepository(SubcategoryOrm);

    async findById(id: string): Promise<Course | null> {
        const row = await this.repo.findOne({
            where: { id },
            relations: {
                categories: {
                    category: true,
                    subcategories: { subcategory: { category: true } }
                }
            }
        });
        return row ? this.toDomain(row) : null;
    }

    async findBySchoolAndName(schoolId: string, name: string): Promise<Course | null> {
        const row = await this.repo.findOne({
            where: { schoolId, name },
            relations: {
                categories: {
                    category: true,
                    subcategories: { subcategory: { category: true } }
                }
            }
        });
        return row ? this.toDomain(row) : null;
    }

    async save(course: Course): Promise<void> {
        const row = await this.toOrm(course);
        await this.repo.save(row);
    }

    private toDomain(row: CourseOrm): Course {
        return Course.create({
            id: row.id,
            schoolId: row.schoolId,
            name: row.name,
            description: row.description,
            categories: Array.isArray(row.categories)
                ? row.categories.map((link) => ({
                    categoryId: link.categoryId,
                    subcategoryIds: Array.isArray(link.subcategories)
                        ? link.subcategories.map((subLink) => subLink.subcategoryId)
                        : []
                }))
                : [],
            isActive: row.isActive,
            createdAt: row.createdAt
        });
    }

    private async toOrm(course: Course): Promise<CourseOrm> {
        const row = new CourseOrm();
        row.id = course.id;
        row.schoolId = course.schoolId;
        row.name = course.name;
        row.description = course.description;
        row.isActive = course.isActive;
        row.createdAt = course.createdAt;
        row.categories = await this.createCategoryLinks(row, course.categories);
        return row;
    }

    private async createCategoryLinks(
        course: CourseOrm,
        categories: Array<{ categoryId: string; subcategoryIds: string[] }>
    ): Promise<CourseCategoryOrm[]> {
        if (!categories.length) return [];

        const uniqueCategoryIds = Array.from(new Set(categories.map((item) => item.categoryId)));
        const categoryRows = await this.categoriesRepo.findBy({ id: In(uniqueCategoryIds) });
        const categoryMap = new Map(categoryRows.map((row) => [row.id, row]));

        if (categoryMap.size !== uniqueCategoryIds.length) {
            const missing = uniqueCategoryIds.filter((id) => !categoryMap.has(id));
            throw new Error(`Unknown categories: ${missing.join(', ')}`);
        }

        const links: CourseCategoryOrm[] = [];

        for (const categoryData of categories) {
            const category = categoryMap.get(categoryData.categoryId)!;
            const link = new CourseCategoryOrm();
            link.id = Uuid();
            link.course = course;
            link.courseId = course.id;
            link.category = category;
            link.categoryId = category.id;
            link.subcategories = await this.createSubcategoryLinks(link, category, categoryData.subcategoryIds);
            links.push(link);
        }

        return links;
    }

    private async createSubcategoryLinks(
        courseCategory: CourseCategoryOrm,
        category: CategoryOrm,
        subcategoryIds: string[]
    ): Promise<CourseCategorySubcategoryOrm[]> {
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
            const link = new CourseCategorySubcategoryOrm();
            link.id = Uuid();
            link.courseCategory = courseCategory;
            link.courseCategoryId = courseCategory.id;
            link.subcategory = subcategory;
            link.subcategoryId = subcategory.id;
            return link;
        });
    }
}
