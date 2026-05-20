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
            where: { id, deletedAt: null as any },
            relations: {
                categories: {
                    category: true,
                    subcategories: { subcategory: { category: true } }
                }
            }
        });
        return row ? this.toDomain(row) : null;
    }

    async findByIdIncludingDeleted(id: string): Promise<Course | null> {
        const row = await this.repo.findOne({
            where: { id },
            withDeleted: true,
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
            where: { schoolId, name, isActive: true, deletedAt: null as any },
            relations: {
                categories: {
                    category: true,
                    subcategories: { subcategory: { category: true } }
                }
            }
        });
        return row ? this.toDomain(row) : null;
    }

    async findBySchoolId(schoolId: string): Promise<Course[]> {
        const rows = await this.repo.find({
            where: { schoolId, isActive: true, deletedAt: null as any },
            order: { createdAt: 'DESC' },
            relations: {
                categories: {
                    category: true,
                    subcategories: { subcategory: { category: true } }
                }
            }
        });
        return rows.map((row) => this.toDomain(row));
    }

    async countActiveBySchoolId(schoolId: string): Promise<number> {
        return await this.repo.count({
            where: { schoolId, isActive: true, deletedAt: null as any }
        });
    }

    async findCategoriesByCourseIds(courseIds: string[]): Promise<import('../../../ports/repositories/course.repo').CourseCategoryInfo[]> {
        if (courseIds.length === 0) return [];

        const results = await AppDataSource.query(`
            SELECT 
                cc.course_id,
                c.name AS category_name,
                s.name AS subcategory_name
            FROM course_categories cc
            INNER JOIN categories c ON c.id = cc.category_id
            LEFT JOIN course_category_subcategories ccs ON ccs.course_category_id = cc.id
            LEFT JOIN subcategories s ON s.id = ccs.subcategory_id
            WHERE cc.course_id IN (${courseIds.map(() => '?').join(',')})
            ORDER BY cc.created_at ASC
        `, courseIds);

        const categoriesMap = new Map<string, { category: string | null; subcategory: string | null }>();
        for (const row of results) {
            const courseId = row.course_id;
            if (!categoriesMap.has(courseId)) {
                categoriesMap.set(courseId, {
                    category: row.category_name || null,
                    subcategory: row.subcategory_name || null
                });
            } else {
                const existing = categoriesMap.get(courseId)!;
                if (!existing.subcategory && row.subcategory_name) {
                    existing.subcategory = row.subcategory_name;
                }
            }
        }

        return courseIds.map(courseId => {
            const info = categoriesMap.get(courseId) || { category: null, subcategory: null };
            return {
                courseId,
                category: info.category,
                subcategory: info.subcategory
            };
        });
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
            deletedAt: row.deletedAt,
            createdAt: row.createdAt,
            monthlyPriceCents: row.monthlyPriceCents
        });
    }

    private async toOrm(course: Course): Promise<CourseOrm> {
        const existing = await this.repo.findOne({
            where: { id: course.id },
            relations: {
                categories: { subcategories: true }
            }
        });

        const row = existing ?? new CourseOrm();
        row.id = course.id;
        row.schoolId = course.schoolId;
        row.name = course.name;
        row.description = course.description;
        row.monthlyPriceCents = course.monthlyPriceCents;
        row.isActive = course.isActive;
        row.createdAt = existing?.createdAt ?? course.createdAt;
        row.deletedAt = course.deletedAt;

        if (existing) {
            const categoryIds = existing.categories?.map((link) => link.id) ?? [];
            if (categoryIds.length > 0) {
                await this.repo.manager.createQueryBuilder()
                    .delete()
                    .from(CourseCategorySubcategoryOrm)
                    .where('course_category_id IN (:...ids)', { ids: categoryIds })
                    .execute();
            }
            await this.repo.manager.createQueryBuilder()
                .delete()
                .from(CourseCategoryOrm)
                .where('course_id = :id', { id: course.id })
                .execute();
        }

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

    async findAllWithFilters(filters: {
        name?: string;
        search?: string;
        categoryId?: string;
        subcategoryId?: string;
        city?: string;
    }): Promise<import('../../../ports/repositories/course.repo').CourseWithSchoolInfo[]> {
        const queryBuilder = this.repo
            .createQueryBuilder('course')
            .leftJoin('course.school', 'school')
            .leftJoin('school.addresses', 'address')
            .where('course.isActive = :isActive', { isActive: true })
            .andWhere('course.deletedAt IS NULL')
            .select([
                'course.id AS courseId',
                'course.name AS courseName',
                'course.description AS courseDescription',
                'school.id AS schoolId',
                'school.name AS schoolName',
                'MIN(address.city) AS schoolCity',
                'MIN(address.state) AS schoolState'
            ])
            .groupBy('course.id')
            .addGroupBy('course.name')
            .addGroupBy('course.description')
            .addGroupBy('school.id')
            .addGroupBy('school.name');

        // Filtro por nome do curso
        if (filters.name) {
            queryBuilder.andWhere('course.name LIKE :name', { name: `%${filters.name}%` });
        }

        // Busca por texto: nome do curso ou da escola
        if (filters.search) {
            queryBuilder.andWhere('(course.name LIKE :search OR school.name LIKE :search)', {
                search: `%${filters.search}%`
            });
        }

        // Filtro por cidade
        if (filters.city) {
            queryBuilder.andHaving('MIN(address.city) LIKE :city', { city: `%${filters.city}%` });
        }

        // Filtro por categoria ou subcategoria
        if (filters.categoryId || filters.subcategoryId) {
            queryBuilder
                .leftJoin('course.categories', 'courseCategory')
                .leftJoin('courseCategory.category', 'category')
                .leftJoin('courseCategory.subcategories', 'courseCategorySubcategory')
                .leftJoin('courseCategorySubcategory.subcategory', 'subcategory');

            if (filters.categoryId) {
                queryBuilder.andWhere('category.id = :categoryId', { categoryId: filters.categoryId });
            }

            if (filters.subcategoryId) {
                queryBuilder.andWhere('subcategory.id = :subcategoryId', { subcategoryId: filters.subcategoryId });
            }
        }

        const results = await queryBuilder.getRawMany();

        return results.map((row: any) => ({
            courseId: row.courseId,
            courseName: row.courseName,
            courseDescription: row.courseDescription,
            schoolId: row.schoolId,
            schoolName: row.schoolName,
            schoolCity: row.schoolCity || null,
            schoolState: row.schoolState || null
        }));
    }
}


