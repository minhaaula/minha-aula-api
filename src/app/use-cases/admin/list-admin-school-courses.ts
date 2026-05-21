import type { CourseClassScheduleEntry } from '../../../domain/entities/course-class';
import { CourseRepository } from '../../../ports/repositories/course.repo';
import { CategoryRepository } from '../../../ports/repositories/category.repo';
import { CourseClassRepository } from '../../../ports/repositories/course-class.repo';
import { EnrollmentRepository } from '../../../ports/repositories/enrollment.repo';
import { equalUuid } from '../../../shared/normalize-uuid';

export type AdminSchoolCourseClassItem = {
    id: string;
    label: string;
    description: string | null;
    schedule: ReadonlyArray<CourseClassScheduleEntry>;
    monthlyPriceCents: number | null;
    capacity: number | null;
    classType: 'PRESENCIAL' | 'ONLINE';
    createdAt: Date;
    studentCount: number;
};

export type AdminSchoolCourseItem = {
    id: string;
    schoolId: string;
    name: string;
    description: string | null;
    categories: Array<{
        id: string;
        name: string | null;
        subcategories: Array<{ id: string; name: string | null }>;
    }>;
    createdAt: Date;
    classes: AdminSchoolCourseClassItem[];
};

export class ListAdminSchoolCourses {
    constructor(
        private readonly courses: CourseRepository,
        private readonly categories: CategoryRepository,
        private readonly classes: CourseClassRepository,
        private readonly enrollments: EnrollmentRepository
    ) {}

    async exec(input: { schoolId: string }): Promise<AdminSchoolCourseItem[]> {
        const schoolId = input.schoolId.trim();
        if (!schoolId) {
            return [];
        }

        const [courses, categoryCatalog] = await Promise.all([
            this.courses.findBySchoolId(schoolId),
            this.categories.findAllWithSubcategories()
        ]);

        const activeCourses = courses.filter(
            (c) => c.isActive && equalUuid(c.schoolId, schoolId)
        );
        const courseIds = activeCourses.map((c) => c.id);
        if (courseIds.length === 0) return [];

        const classList = await this.classes.findByCourseIds(courseIds);
        const classIds = classList.map((c) => c.id);
        const activeEnrollments =
            classIds.length > 0
                ? await this.enrollments.findActiveByClassIds(classIds)
                : [];

        const enrollmentsList = new Map<string, number>();
        for (const c of classList) {
            enrollmentsList.set(c.id, 0);
        }
        for (const e of activeEnrollments) {
            enrollmentsList.set(e.courseClassId, (enrollmentsList.get(e.courseClassId) ?? 0) + 1);
        }

        const categoriesById = new Map<string, { name: string; subcategories: Map<string, string> }>();
        for (const category of categoryCatalog) {
            categoriesById.set(category.id, {
                name: category.name,
                subcategories: new Map(category.subcategories.map((sub) => [sub.id, sub.name]))
            });
        }

        const classesByCourseId = new Map<string, typeof classList>();
        for (const c of classList) {
            const key = c.courseId.trim().toLowerCase();
            if (!classesByCourseId.has(key)) {
                classesByCourseId.set(key, []);
            }
            classesByCourseId.get(key)!.push(c);
        }

        return courses
            .filter((course) => course.isActive && equalUuid(course.schoolId, schoolId))
            .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
            .map((course) => {
                const courseClasses = classesByCourseId.get(course.id.trim().toLowerCase()) ?? [];
                const classesWithCount = courseClasses.map((courseClass) => ({
                    id: courseClass.id,
                    label: courseClass.label,
                    description: null as string | null,
                    schedule: courseClass.schedule.map((entry) => ({ ...entry })),
                    monthlyPriceCents: courseClass.monthlyPriceCents,
                    capacity: courseClass.capacity,
                    classType: courseClass.classType,
                    createdAt: courseClass.createdAt,
                    studentCount: enrollmentsList.get(courseClass.id) ?? 0
                }));

                return {
                    id: course.id,
                    schoolId: course.schoolId,
                    name: course.name,
                    description: course.description,
                    categories: course.categories.map((category) => {
                        const categoryInfo = categoriesById.get(category.categoryId);
                        const subcategories = category.subcategoryIds.map((subcategoryId) => ({
                            id: subcategoryId,
                            name: categoryInfo?.subcategories.get(subcategoryId) ?? null
                        }));
                        return {
                            id: category.categoryId,
                            name: categoryInfo?.name ?? null,
                            subcategories
                        };
                    }),
                    createdAt: course.createdAt,
                    classes: classesWithCount
                };
            });
    }
}
