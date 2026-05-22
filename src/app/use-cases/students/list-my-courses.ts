import { EnrollmentRepository } from '../../../ports/repositories/enrollment.repo';
import { CourseRepository } from '../../../ports/repositories/course.repo';
import { SchoolRepository } from '../../../ports/repositories/school.repo';
import { SchoolImageRepository } from '../../../ports/repositories/school-image.repo';
import { SchoolImageCategory } from '../../../domain/value-objects/school-image-category';
import type { StorageProviderPort } from '../../../ports/providers/storage-provider.port';
import type { MyCourseEnrollmentStatus } from '../../../ports/repositories/enrollment.repo';

export interface MyCourseRecord {
    courseName: string;
    schoolId: string;
    schoolName: string;
    schoolLogo: string | null;
    studentName: string;
    category: string | null;
    subcategory: string | null;
    subcategories: string[];
    city: string | null;
    schedule: Array<{ day: string; start: string; end: string }>;
    /** Curso ativo na escola (`courses.is_active`). */
    active: boolean;
    /** Status da matrícula (ex.: CANCELLED após desmatrícula). */
    enrollmentStatus: MyCourseEnrollmentStatus;
}

export class ListMyCourses {
    constructor(
        private readonly enrollments: EnrollmentRepository,
        private readonly courses: CourseRepository,
        private readonly schools: SchoolRepository,
        private readonly schoolImages?: SchoolImageRepository,
        private readonly storage?: StorageProviderPort
    ) {}

    async exec(input: { userId: string }): Promise<{ courses: MyCourseRecord[] }> {
        const userId = input.userId?.trim();
        if (!userId) {
            return { courses: [] };
        }

        if (!this.enrollments.findMyCourses) {
            return { courses: [] };
        }

        // Matrículas do usuário e dependentes (ativas, canceladas e concluídas)
        const myCoursesData = await this.enrollments.findMyCourses(userId);

        if (myCoursesData.length === 0) {
            return { courses: [] };
        }

        // Buscar cidades das escolas
        const schoolIds = [...new Set(myCoursesData.map(c => c.schoolId))];
        const citiesData = this.schools.findCitiesBySchoolIds 
            ? await this.schools.findCitiesBySchoolIds(schoolIds)
            : [];
        const citiesMap = new Map(citiesData.map(c => [c.schoolId, c.city]));

        // Buscar categorias e subcategorias para cada curso
        const courseIds = [...new Set(myCoursesData.map(c => c.courseId))];
        const categoriesData = this.courses.findCategoriesByCourseIds
            ? await this.courses.findCategoriesByCourseIds(courseIds)
            : [];
        const categoriesMap = new Map(categoriesData.map(c => [c.courseId, c]));

        // Logos das escolas
        const logoMap = new Map<string, string | null>();
        if (this.schoolImages && this.storage && schoolIds.length > 0) {
            await Promise.all(
                schoolIds.map(async (schoolId) => {
                    try {
                        const logos = await this.schoolImages!.findBySchoolId(schoolId, SchoolImageCategory.LOGO);
                        const logo = logos[0];
                        if (logo) {
                            const url = await this.storage!.getFileUrl(logo.key, 3600);
                            logoMap.set(schoolId, url);
                        } else {
                            logoMap.set(schoolId, null);
                        }
                    } catch {
                        logoMap.set(schoolId, null);
                    }
                })
            );
        }

        // Construir resultado final
        const courses: MyCourseRecord[] = myCoursesData.map((data) => {
            const catInfo = categoriesMap.get(data.courseId) ?? {
                category: null,
                subcategory: null,
                subcategories: [] as string[]
            };
            const city = citiesMap.get(data.schoolId) || null;

            return {
                courseName: data.courseName,
                schoolId: data.schoolId,
                schoolName: data.schoolName,
                schoolLogo: this.schoolImages && this.storage ? (logoMap.get(data.schoolId) ?? null) : null,
                studentName: data.studentName,
                category: catInfo.category,
                subcategory: catInfo.subcategory,
                subcategories: catInfo.subcategories,
                city: city,
                schedule: data.schedule,
                active: data.active,
                enrollmentStatus: data.enrollmentStatus
            };
        });

        return { courses };
    }
}

