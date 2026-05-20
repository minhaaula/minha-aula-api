import { describe, expect, it } from 'vitest';
import { ListAllCourses } from '../../src/app/use-cases/list-all-courses';
import { CourseRepository } from '../../src/ports/repositories/course.repo';
import { CategoryRepository } from '../../src/ports/repositories/category.repo';
import type { SchoolReviewRepository } from '../../src/ports/repositories/school-review.repo';
import type { SchoolImageRepository } from '../../src/ports/repositories/school-image.repo';
import type { StorageProviderPort } from '../../src/ports/providers/storage-provider.port';
import { SchoolImage } from '../../src/domain/entities/school-image';
import { SchoolImageCategory } from '../../src/domain/value-objects/school-image-category';

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
        search?: string;
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

            if (filters?.search) {
                const term = filters.search.toLowerCase();
                const inCourse = data.courseName.toLowerCase().includes(term);
                const inSchool = data.schoolName.toLowerCase().includes(term);
                if (!inCourse && !inSchool) {
                    matches = false;
                }
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
                    schoolCity: data.schoolCity,
                    schoolState: data.schoolState ?? null
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
        schoolState?: string | null;
        categoryId?: string;
        subcategoryId?: string;
    }) {
        this.items.set(data.courseId, {
            courseName: data.courseName,
            courseDescription: data.courseDescription,
            schoolId: data.schoolId,
            schoolName: data.schoolName,
            schoolCity: data.schoolCity,
            schoolState: data.schoolState ?? null,
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
    async findById() {
        return null;
    }
    async findByName() {
        return null;
    }
    async save() {}
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
        expect(result.courses[0].schoolCity).toBe('São Paulo');
        expect(result.courses[0].schoolState).toBeNull();
        expect(result.courses[0].schoolRatingAverage).toBeNull();
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

    it('filters courses by search (course or school name)', async () => {
        const coursesRepo = new InMemoryCourseRepository();
        const categoriesRepo = new InMemoryCategoryRepository();

        coursesRepo.seedCourse({
            courseId: 'course-1',
            courseName: 'Violão',
            courseDescription: null,
            schoolId: 'school-1',
            schoolName: 'Academia Iguape',
            schoolCity: 'Iguape'
        });

        coursesRepo.seedCourse({
            courseId: 'course-2',
            courseName: 'Piano',
            courseDescription: null,
            schoolId: 'school-2',
            schoolName: 'Escola Central',
            schoolCity: 'Iguape'
        });

        const useCase = new ListAllCourses(coursesRepo, categoriesRepo);

        const bySchool = await useCase.exec({ search: 'iguape' });
        expect(bySchool.courses).toHaveLength(1);
        expect(bySchool.courses[0].schoolName).toBe('Academia Iguape');

        const byCourse = await useCase.exec({ search: 'piano' });
        expect(byCourse.courses).toHaveLength(1);
        expect(byCourse.courses[0].courseName).toBe('Piano');
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

    it('returns schoolCity, schoolState and schoolRatingAverage in each course', async () => {
        const coursesRepo = new InMemoryCourseRepository();
        const categoriesRepo = new InMemoryCategoryRepository();
        const schoolReviewsRepo: SchoolReviewRepository = {
            findMany: async () => [],
            getAverageRatingBySchoolIds: async (schoolIds: string[]) =>
                schoolIds.map((schoolId) => ({
                    schoolId,
                    averageRating: schoolId === 'school-1' ? 4.5 : 3.2,
                    count: 10
                })),
            findByUserAndSchool: async () => null,
            save: async () => {}
        };

        coursesRepo.seedCourse({
            courseId: 'course-1',
            courseName: 'Inglês',
            courseDescription: null,
            schoolId: 'school-1',
            schoolName: 'Escola A',
            schoolCity: 'Belo Horizonte',
            schoolState: 'MG'
        });
        coursesRepo.seedCourse({
            courseId: 'course-2',
            courseName: 'Matemática',
            courseDescription: null,
            schoolId: 'school-2',
            schoolName: 'Escola B',
            schoolCity: 'Curitiba',
            schoolState: 'PR'
        });

        const useCase = new ListAllCourses(coursesRepo, categoriesRepo, undefined, undefined, schoolReviewsRepo);
        const result = await useCase.exec({});

        expect(result.courses).toHaveLength(2);

        const course1 = result.courses.find((c) => c.schoolId === 'school-1')!;
        expect(course1.schoolCity).toBe('Belo Horizonte');
        expect(course1.schoolState).toBe('MG');
        expect(course1.schoolRatingAverage).toBe(4.5);

        const course2 = result.courses.find((c) => c.schoolId === 'school-2')!;
        expect(course2.schoolCity).toBe('Curitiba');
        expect(course2.schoolState).toBe('PR');
        expect(course2.schoolRatingAverage).toBe(3.2);

        expect(course1.schoolReviewsCount).toBe(10);
        expect(course2.schoolReviewsCount).toBe(10);
    });

    it('returns schoolCover URL from BANNER when COVER is absent', async () => {
        const coursesRepo = new InMemoryCourseRepository();
        const categoriesRepo = new InMemoryCategoryRepository();

        coursesRepo.seedCourse({
            courseId: 'course-1',
            courseName: 'Curso',
            courseDescription: null,
            schoolId: 'school-1',
            schoolName: 'Escola Iguape',
            schoolCity: 'Iguape',
            schoolState: 'SP'
        });

        const schoolImagesRepo: SchoolImageRepository = {
            save: async () => {},
            findBySchoolId: async () => [
                SchoolImage.create({
                    id: 'img-banner',
                    schoolId: 'school-1',
                    key: 'schools/school-1/banner.png',
                    contentType: 'image/png',
                    originalFileName: 'banner.png',
                    category: SchoolImageCategory.BANNER
                })
            ],
            findById: async () => null,
            delete: async () => {}
        };

        const storage: StorageProviderPort = {
            uploadFile: async () => 'k',
            deleteFile: async () => {},
            getFileUrl: async (key) => `https://cdn.example/${key}`
        };

        const useCase = new ListAllCourses(coursesRepo, categoriesRepo, schoolImagesRepo, storage);
        const result = await useCase.exec({ city: 'Iguape' });

        expect(result.courses).toHaveLength(1);
        expect(result.courses[0].schoolCover).toBe('https://cdn.example/schools/school-1/banner.png');
        expect(result.courses[0].schoolLogo).toBeNull();
    });

    it('returns schoolReviewsCount 0 when school has no reviews', async () => {
        const coursesRepo = new InMemoryCourseRepository();
        const categoriesRepo = new InMemoryCategoryRepository();
        const schoolReviewsRepo: SchoolReviewRepository = {
            findMany: async () => [],
            getAverageRatingBySchoolIds: async () => [],
            findByUserAndSchool: async () => null,
            save: async () => {}
        };

        coursesRepo.seedCourse({
            courseId: 'course-x',
            courseName: 'X',
            courseDescription: null,
            schoolId: 'school-no-reviews',
            schoolName: 'Escola',
            schoolCity: null,
            schoolState: null
        });

        const useCase = new ListAllCourses(coursesRepo, categoriesRepo, undefined, undefined, schoolReviewsRepo);
        const result = await useCase.exec({});

        expect(result.courses[0].schoolReviewsCount).toBe(0);
        expect(result.courses[0].schoolRatingAverage).toBeNull();
    });
});

