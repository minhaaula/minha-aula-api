import { CourseRepository } from '../../ports/repositories/course.repo';
import { CourseClassRepository } from '../../ports/repositories/course-class.repo';
import { UserRepository } from '../../ports/repositories/user.repo';
import { DependentRepository } from '../../ports/repositories/dependent.repo';
import { EnrollmentRepository } from '../../ports/repositories/enrollment.repo';
import { Enrollment } from '../../domain/entities/enrollment';
import { Uuid } from '../../shared/uuid';
import { equalUuid } from '../../shared/normalize-uuid';

export class EnrollStudent {
    constructor(
        private readonly courses: CourseRepository,
        private readonly classes: CourseClassRepository,
        private readonly users: UserRepository,
        private readonly dependents: DependentRepository,
        private readonly enrollments: EnrollmentRepository
    ) {}

    async exec(input: {
        schoolId: string;
        courseId: string;
        classId: string;
        studentUserId: string;
        dependentId?: string | null;
    }): Promise<{
        id: string;
        courseClassId: string;
        ownerUserId: string;
        studentType: Enrollment['studentType'];
        studentUserId: string | null;
        dependentId: string | null;
        status: Enrollment['status'];
        enrolledAt: Date;
        updatedAt: Date;
    }> {
        const schoolId = input.schoolId.trim();
        const courseId = input.courseId.trim();
        const classId = input.classId.trim();
        const studentUserId = input.studentUserId.trim();
        const dependentId = input.dependentId?.trim() || null;

        if (!schoolId || !courseId || !classId || !studentUserId) {
            throw new Error('Missing enrollment data');
        }

        const course = await this.courses.findById(courseId);
        if (!course || !course.isActive || !equalUuid(course.schoolId, schoolId)) {
            throw new Error('Course not found for this school');
        }

        const courseClass = await this.classes.findById(classId);
        if (!courseClass || !courseClass.isActive || !equalUuid(courseClass.courseId, course.id)) {
            throw new Error('Course class not found for this course');
        }

        const owner = await this.users.findById(studentUserId);
        if (!owner) throw new Error('Student user not found');

        let enrollment: Enrollment;
        if (dependentId) {
            const dependent = await this.dependents.findById(dependentId);
            if (!dependent || !equalUuid(dependent.userId, owner.id)) {
                throw new Error('Dependent not found for this student');
            }

            const existing = await this.enrollments.findByClassAndDependent(courseClass.id, dependent.id);
            if (existing) {
                throw new Error('Dependent already enrolled in this class');
            }

            enrollment = Enrollment.createForDependent({
                id: Uuid(),
                courseClassId: courseClass.id,
                ownerUserId: owner.id,
                dependentId: dependent.id
            });
        } else {
            const existing = await this.enrollments.findByClassAndUser(courseClass.id, owner.id);
            if (existing) {
                throw new Error('Student already enrolled in this class');
            }

            enrollment = Enrollment.createForUser({
                id: Uuid(),
                courseClassId: courseClass.id,
                ownerUserId: owner.id,
                studentUserId: owner.id
            });
        }

        await this.enrollments.save(enrollment);

        return {
            id: enrollment.id,
            courseClassId: enrollment.courseClassId,
            ownerUserId: enrollment.ownerUserId,
            studentType: enrollment.studentType,
            studentUserId: enrollment.studentUserId,
            dependentId: enrollment.dependentId,
            status: enrollment.status,
            enrolledAt: enrollment.enrolledAt,
            updatedAt: enrollment.updatedAt
        };
    }
}
