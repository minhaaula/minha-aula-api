import { describe, expect, it } from 'vitest';
import { ListAllCourses } from '../../src/app/use-cases/list-all-courses';
import { CourseRepository } from '../../src/ports/repositories/course.repo';
import { CategoryRepository } from '../../src/ports/repositories/category.repo';

class InMemoryCourseRepository implements CourseRepository {
    private readonly items = new Map<string, any>();
    private readonly categoriesData = new Map<string, any[]>();

    async findById(): Promise<any> {
        return null;
    }

    async findBySchoolAndName(): Promise<any> {
        return null;
    }

    async findBySchoolId(): Promise<any[]> {
        return [];
    }

    async save(): Promise<void> {
        // No-op
    }

    async findAllWithFilters(filters?: {
        name?: string;
        categoryId?: string;
        subcategoryId?: string;
        city?: string;
    }): Promise<any[]> {
        const results: any[] = [];
        
        for (const [courseId, data] of this.items.entries()) {
            let matches = true;

            if (filters?.name && !data.courseName.toLowerCase().includes(filters.name.toLowerCase())) {
                matches = false;
            }

            if (filters?.categoryId && data.categoryId !== filters.categoryId) {
                matches = false;
            }

            if (filters?.subcategoryId && data.subcategoryId !== filters.subcategoryId) {
                matches = false;
            }

            if (filters?.city && data.schoolCity?.toLowerCase() !== filters.city.toLowerCase()) {
                matches = false;
            }

            if (matches) {
                results.push({
                    courseId,
                    courseName: data.courseName,
                    courseDescription: data.courseDescription,
                    schoolId: data.schoolId,
                    schoolName: data.schoolName,
                    schoolCity: data.schoolCity
                });
            }
        }

        return results;
    }

    async findCategoriesByCourseIds(courseIds: string[]): Promise<any[]> {
        return courseIds.map(courseId => {
            const data = this.categoriesData.get(courseId) || { category: null, subcategory: null };
            return {
                courseId,
                category: data.category,
                subcategory: data.subcategory
            };
        });
    }

    seedCourse(data: {
        courseId: string;
        courseName: string;
        courseDescription: string | null;
        schoolId: string;
        schoolName: string;
        schoolCity: string | null;
        categoryId?: string;
        subcategoryId?: string;
    }) {
        this.items.set(data.courseId, {
            courseName: data.courseName,
            courseDescription: data.courseDescription,
            schoolId: data.schoolId,
            schoolName: data.schoolName,
            schoolCity: data.schoolCity,
            categoryId: data.categoryId,
            subcategoryId: data.subcategoryId
        });

        this.categoriesData.set(data.courseId, {
            category: data.categoryId ? `Category-${data.categoryId}` : null,
            subcategory: data.subcategoryId ? `Subcategory-${data.subcategoryId}` : null
        });
    }
}

class InMemoryCategoryRepository implements CategoryRepository {
    async findAllWithSubcategories() {
        return [];
    }
}

describe('ListAllCourses use case', () => {
    it('returns all courses with categories and subcategories', async () => {
        const coursesRepo = new InMemoryCourseRepository();
        const categoriesRepo = new InMemoryCategoryRepository();

        coursesRepo.seedCourse({
            courseId: 'course-1',
            courseName: 'Inglês Básico',
            courseDescription: 'Curso de inglês para iniciantes',
            schoolId: 'school-1',
            schoolName: 'Escola de Idiomas',
            schoolCity: 'São Paulo',
            categoryId: 'cat-1',
            subcategoryId: 'sub-1'
        });

        coursesRepo.seedCourse({
            courseId: 'course-2',
            courseName: 'Matemática Avançada',
            courseDescription: 'Curso de matemática avançada',
            schoolId: 'school-2',
            schoolName: 'Escola de Exatas',
            schoolCity: 'Rio de Janeiro',
            categoryId: 'cat-2',
            subcategoryId: 'sub-2'
        });

        const useCase = new ListAllCourses(coursesRepo, categoriesRepo);
        const result = await useCase.exec({});

        expect(result.courses).toHaveLength(2);
        expect(result.courses[0].courseName).toBe('Inglês Básico');
        expect(result.courses[0].schoolName).toBe('Escola de Idiomas');
        expect(result.courses[0].schoolId).toBe('school-1');
        expect(result.courses[0].courseDescription).toBe('Curso de inglês para iniciantes');
        expect(result.courses[0].category).toBe('Category-cat-1');
        expect(result.courses[0].subcategory).toBe('Subcategory-sub-1');
    });

    it('filters courses by name', async () => {
        const coursesRepo = new InMemoryCourseRepository();
        const categoriesRepo = new InMemoryCategoryRepository();

        coursesRepo.seedCourse({
            courseId: 'course-1',
            courseName: 'Inglês Básico',
            courseDescription: null,
            schoolId: 'school-1',
            schoolName: 'Escola de Idiomas',
            schoolCity: 'São Paulo'
        });

        coursesRepo.seedCourse({
            courseId: 'course-2',
            courseName: 'Matemática Avançada',
            courseDescription: null,
            schoolId: 'school-2',
            schoolName: 'Escola de Exatas',
            schoolCity: 'Rio de Janeiro'
        });

        const useCase = new ListAllCourses(coursesRepo, categoriesRepo);
        const result = await useCase.exec({ name: 'Inglês' });

        expect(result.courses).toHaveLength(1);
        expect(result.courses[0].courseName).toBe('Inglês Básico');
    });

    it('filters courses by category', async () => {
        const coursesRepo = new InMemoryCourseRepository();
        const categoriesRepo = new InMemoryCategoryRepository();

        coursesRepo.seedCourse({
            courseId: 'course-1',
            courseName: 'Inglês Básico',
            courseDescription: null,
            schoolId: 'school-1',
            schoolName: 'Escola de Idiomas',
            schoolCity: 'São Paulo',
            categoryId: 'cat-1'
        });

        coursesRepo.seedCourse({
            courseId: 'course-2',
            courseName: 'Matemática Avançada',
            courseDescription: null,
            schoolId: 'school-2',
            schoolName: 'Escola de Exatas',
            schoolCity: 'Rio de Janeiro',
            categoryId: 'cat-2'
        });

        const useCase = new ListAllCourses(coursesRepo, categoriesRepo);
        const result = await useCase.exec({ categoryId: 'cat-1' });

        expect(result.courses).toHaveLength(1);
        expect(result.courses[0].courseName).toBe('Inglês Básico');
    });

    it('filters courses by city', async () => {
        const coursesRepo = new InMemoryCourseRepository();
        const categoriesRepo = new InMemoryCategoryRepository();

        coursesRepo.seedCourse({
            courseId: 'course-1',
            courseName: 'Inglês Básico',
            courseDescription: null,
            schoolId: 'school-1',
            schoolName: 'Escola de Idiomas',
            schoolCity: 'São Paulo'
        });

        coursesRepo.seedCourse({
            courseId: 'course-2',
            courseName: 'Matemática Avançada',
            courseDescription: null,
            schoolId: 'school-2',
            schoolName: 'Escola de Exatas',
            schoolCity: 'Rio de Janeiro'
        });

        const useCase = new ListAllCourses(coursesRepo, categoriesRepo);
        const result = await useCase.exec({ city: 'São Paulo' });

        expect(result.courses).toHaveLength(1);
        expect(result.courses[0].courseName).toBe('Inglês Básico');
        expect(result.courses[0].schoolName).toBe('Escola de Idiomas');
        expect(result.courses[0].schoolId).toBe('school-1');
    });

    it('returns empty list when no courses match filters', async () => {
        const coursesRepo = new InMemoryCourseRepository();
        const categoriesRepo = new InMemoryCategoryRepository();

        coursesRepo.seedCourse({
            courseId: 'course-1',
            courseName: 'Inglês Básico',
            courseDescription: null,
            schoolId: 'school-1',
            schoolName: 'Escola de Idiomas',
            schoolCity: 'São Paulo'
        });

        const useCase = new ListAllCourses(coursesRepo, categoriesRepo);
        const result = await useCase.exec({ name: 'Espanhol' });

        expect(result.courses).toHaveLength(0);
    });

    it('returns empty list when repository does not support findAllWithFilters', async () => {
        const coursesRepo = {
            findById: async () => null,
            findBySchoolAndName: async () => null,
            findBySchoolId: async () => [],
            save: async () => {}
        } as CourseRepository;

        const categoriesRepo = new InMemoryCategoryRepository();
        const useCase = new ListAllCourses(coursesRepo, categoriesRepo);
        const result = await useCase.exec({});

        expect(result.courses).toHaveLength(0);
    });

    it('handles courses without categories', async () => {
        const coursesRepo = new InMemoryCourseRepository();
        const categoriesRepo = new InMemoryCategoryRepository();

        coursesRepo.seedCourse({
            courseId: 'course-1',
            courseName: 'Curso Sem Categoria',
            courseDescription: 'Curso sem categoria definida',
            schoolId: 'school-1',
            schoolName: 'Escola Teste',
            schoolCity: 'São Paulo'
        });

        const useCase = new ListAllCourses(coursesRepo, categoriesRepo);
        const result = await useCase.exec({});

        expect(result.courses).toHaveLength(1);
        expect(result.courses[0].category).toBeNull();
        expect(result.courses[0].subcategory).toBeNull();
    });
});

