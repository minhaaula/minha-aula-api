import { EnrollmentRepository } from '../../ports/repositories/enrollment.repo';
import { CourseRepository } from '../../ports/repositories/course.repo';
import { SchoolRepository } from '../../ports/repositories/school.repo';

export interface MyCourseRecord {
    courseName: string;
    schoolId: string;
    schoolName: string;
    studentName: string;
    category: string | null;
    subcategory: string | null;
    city: string | null;
    schedule: Array<{ day: string; start: string; end: string }>;
}

export class ListMyCourses {
    constructor(
        private readonly enrollments: EnrollmentRepository,
        private readonly courses: CourseRepository,
        private readonly schools: SchoolRepository
    ) {}

    async exec(input: { userId: string }): Promise<{ courses: MyCourseRecord[] }> {
        const userId = input.userId?.trim();
        if (!userId) {
            return { courses: [] };
        }

        if (!this.enrollments.findMyCourses) {
            return { courses: [] };
        }

        // Buscar todas as matrículas ativas do usuário e seus dependentes
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

        // Construir resultado final
        const courses: MyCourseRecord[] = myCoursesData.map((data) => {
            const catInfo = categoriesMap.get(data.courseId) || { category: null, subcategory: null };
            const city = citiesMap.get(data.schoolId) || null;

            return {
                courseName: data.courseName,
                schoolId: data.schoolId,
                schoolName: data.schoolName,
                studentName: data.studentName,
                category: catInfo.category,
                subcategory: catInfo.subcategory,
                city: city,
                schedule: data.schedule
            };
        });

        return { courses };
    }
}

