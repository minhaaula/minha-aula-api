import { UserRepository } from '../../ports/repositories/user.repo';
import { DependentRepository } from '../../ports/repositories/dependent.repo';
import { EnrollmentRepository } from '../../ports/repositories/enrollment.repo';
import { CourseRepository } from '../../ports/repositories/course.repo';
import { CourseClassRepository } from '../../ports/repositories/course-class.repo';
import { SchoolFinancialChargeRepository } from '../../ports/repositories/school-financial-charge.repo';
import { AppDataSource } from '../../infra/db/typeorm/datasource';
import { EnrollmentOrm } from '../../infra/db/typeorm/entities/enrollment.orm';
import { SchoolFinancialChargeOrm } from '../../infra/db/typeorm/entities/school-financial-charge.orm';
import { AppError, ErrorCode } from '../../shared/errors';

export interface GetSchoolStudentDetailsInput {
    schoolId: string;
    studentId: string;
}

export interface GetSchoolStudentDetailsOutput {
    student: {
        id: string;
        fullName: string;
        email: string;
        phone: string;
        cpf: string;
        birthDate: Date | null;
    };
    responsible: {
        id: string;
        fullName: string;
        email: string;
        phone: string;
        cpf: string;
    } | null;
    enrollments: Array<{
        id: string;
        course: {
            id: string;
            name: string;
        };
        class: {
            id: string;
            label: string;
        };
        enrolledAt: Date;
        status: string;
    }>;
    paidCharges: Array<{
        id: string;
        amount: number;
        amountCents: number;
        discount: number | null;
        discountCents: number | null;
        netAmount: number;
        netAmountCents: number;
        description: string | null;
        dueDate: Date;
        paidAt: Date | null;
        status: string;
        course: {
            id: string;
            name: string;
        };
        class: {
            id: string;
            label: string;
        };
    }>;
}

export class GetSchoolStudentDetails {
    constructor(
        private readonly users: UserRepository,
        private readonly dependents: DependentRepository,
        private readonly enrollments: EnrollmentRepository,
        private readonly courses: CourseRepository,
        private readonly classes: CourseClassRepository,
        private readonly charges: SchoolFinancialChargeRepository
    ) {}

    async exec(input: GetSchoolStudentDetailsInput): Promise<GetSchoolStudentDetailsOutput | null> {
        const schoolId = input.schoolId.trim();
        const studentId = input.studentId.trim();

        if (!schoolId || !studentId) {
            throw AppError.fromCode(ErrorCode.INVALID_IDENTIFIERS, {
                message: 'schoolId e studentId são obrigatórios'
            });
        }

        // Verificar se o aluno tem matrícula na escola
        const hasEnrollment = await this.checkStudentEnrollmentInSchool(schoolId, studentId);
        if (!hasEnrollment) {
            return null; // Aluno não está vinculado à escola
        }

        // Buscar dados do aluno (pode ser usuário ou dependente)
        const student = await this.users.findById(studentId);
        if (!student) {
            // Se não encontrou como usuário, pode ser dependente
            const dependent = await this.dependents.findById(studentId);
            if (!dependent) {
                throw AppError.fromCode(ErrorCode.STUDENT_NOT_FOUND, { studentId });
            }

            // Buscar responsável
            const responsible = await this.users.findById(dependent.userId);
            if (!responsible) {
                throw AppError.fromCode(ErrorCode.USER_NOT_FOUND, { userId: dependent.userId });
            }

            // Buscar matrículas e cobranças do dependente
            const enrollments = await this.findEnrollmentsForDependent(schoolId, dependent.id);
            const paidCharges = await this.findPaidChargesForDependent(schoolId, dependent.id);

            return {
                student: {
                    id: dependent.id,
                    fullName: dependent.fullName,
                    email: '', // Dependente não tem email próprio
                    phone: '', // Dependente não tem telefone próprio
                    cpf: dependent.cpf || '',
                    birthDate: dependent.birthDate
                },
                responsible: {
                    id: responsible.id,
                    fullName: responsible.fullName,
                    email: responsible.email.value,
                    phone: responsible.phone,
                    cpf: responsible.cpf
                },
                enrollments,
                paidCharges
            };
        }

        // Aluno é usuário direto
        // Buscar matrículas e cobranças do aluno
        const enrollments = await this.findEnrollmentsForUser(schoolId, student.id);
        const paidCharges = await this.findPaidChargesForUser(schoolId, student.id);

        return {
            student: {
                id: student.id,
                fullName: student.fullName,
                email: student.email.value,
                phone: student.phone,
                cpf: student.cpf,
                birthDate: student.birthDate
            },
            responsible: null, // Aluno próprio não tem responsável
            enrollments,
            paidCharges
        };
    }

    private async checkStudentEnrollmentInSchool(schoolId: string, studentId: string): Promise<boolean> {
        const enrollmentRepo = AppDataSource.getRepository(EnrollmentOrm);
        
        // Verificar se existe matrícula do aluno (como usuário) na escola
        const userEnrollment = await enrollmentRepo
            .createQueryBuilder('enrollment')
            .innerJoin('enrollment.courseClass', 'class')
            .innerJoin('class.course', 'course')
            .where('course.schoolId = :schoolId', { schoolId })
            .andWhere('enrollment.studentUserId = :studentId', { studentId })
            .andWhere('enrollment.status = :status', { status: 'ACTIVE' })
            .getCount();

        if (userEnrollment > 0) {
            return true;
        }

        // Verificar se existe matrícula do aluno (como dependente) na escola
        const dependentEnrollment = await enrollmentRepo
            .createQueryBuilder('enrollment')
            .innerJoin('enrollment.courseClass', 'class')
            .innerJoin('class.course', 'course')
            .where('course.schoolId = :schoolId', { schoolId })
            .andWhere('enrollment.dependentId = :studentId', { studentId })
            .andWhere('enrollment.status = :status', { status: 'ACTIVE' })
            .getCount();

        return dependentEnrollment > 0;
    }

    private async findEnrollmentsForUser(schoolId: string, userId: string): Promise<GetSchoolStudentDetailsOutput['enrollments']> {
        const enrollmentRepo = AppDataSource.getRepository(EnrollmentOrm);
        
        const enrollments = await enrollmentRepo
            .createQueryBuilder('enrollment')
            .innerJoin('enrollment.courseClass', 'class')
            .innerJoin('class.course', 'course')
            .where('course.schoolId = :schoolId', { schoolId })
            .andWhere('enrollment.studentUserId = :userId', { userId })
            .select([
                'enrollment.id',
                'enrollment.enrolledAt',
                'enrollment.status',
                'course.id',
                'course.name',
                'class.id',
                'class.label'
            ])
            .getRawMany();

        return enrollments.map((row: any) => ({
            id: row.enrollment_id,
            course: {
                id: row.course_id,
                name: row.course_name
            },
            class: {
                id: row.class_id,
                label: row.class_label
            },
            enrolledAt: row.enrollment_enrolled_at,
            status: row.enrollment_status
        }));
    }

    private async findEnrollmentsForDependent(schoolId: string, dependentId: string): Promise<GetSchoolStudentDetailsOutput['enrollments']> {
        const enrollmentRepo = AppDataSource.getRepository(EnrollmentOrm);
        
        const enrollments = await enrollmentRepo
            .createQueryBuilder('enrollment')
            .innerJoin('enrollment.courseClass', 'class')
            .innerJoin('class.course', 'course')
            .where('course.schoolId = :schoolId', { schoolId })
            .andWhere('enrollment.dependentId = :dependentId', { dependentId })
            .select([
                'enrollment.id',
                'enrollment.enrolledAt',
                'enrollment.status',
                'course.id',
                'course.name',
                'class.id',
                'class.label'
            ])
            .getRawMany();

        return enrollments.map((row: any) => ({
            id: row.enrollment_id,
            course: {
                id: row.course_id,
                name: row.course_name
            },
            class: {
                id: row.class_id,
                label: row.class_label
            },
            enrolledAt: row.enrollment_enrolled_at,
            status: row.enrollment_status
        }));
    }

    private async findPaidChargesForUser(schoolId: string, userId: string): Promise<GetSchoolStudentDetailsOutput['paidCharges']> {
        const chargeRepo = AppDataSource.getRepository(SchoolFinancialChargeOrm);

        const charges = await chargeRepo
            .createQueryBuilder('charge')
            .innerJoin('charge.course', 'course')
            .innerJoin('charge.courseClass', 'class')
            .where('charge.schoolId = :schoolId', { schoolId })
            .andWhere('charge.studentUserId = :userId', { userId })
            .andWhere('charge.status NOT IN (:...excludedStatuses)', { excludedStatuses: ['CANCELLED'] })
            .select([
                'charge.id AS charge_id',
                'charge.amountCents AS charge_amount_cents',
                'charge.discountCents AS charge_discount_cents',
                'charge.netAmountCents AS charge_net_amount_cents',
                'charge.description AS charge_description',
                'charge.dueDate AS charge_due_date',
                'charge.paidAt AS charge_paid_at',
                'charge.status AS charge_status',
                'course.id AS course_id',
                'course.name AS course_name',
                'class.id AS class_id',
                'class.label AS class_label'
            ])
            .orderBy('charge.paidAt', 'DESC')
            .addOrderBy('charge.dueDate', 'DESC')
            .getRawMany();

        return charges.map((row: any) => ({
            id: row.charge_id,
            amount: row.charge_amount_cents / 100,
            amountCents: row.charge_amount_cents,
            discount: row.charge_discount_cents != null ? row.charge_discount_cents / 100 : null,
            discountCents: row.charge_discount_cents,
            netAmount: row.charge_net_amount_cents / 100,
            netAmountCents: row.charge_net_amount_cents,
            description: row.charge_description,
            dueDate: new Date(row.charge_due_date),
            paidAt: row.charge_paid_at ? new Date(row.charge_paid_at) : null,
            status: row.charge_status,
            course: {
                id: row.course_id,
                name: row.course_name
            },
            class: {
                id: row.class_id,
                label: row.class_label
            }
        }));
    }

    private async findPaidChargesForDependent(schoolId: string, dependentId: string): Promise<GetSchoolStudentDetailsOutput['paidCharges']> {
        const chargeRepo = AppDataSource.getRepository(SchoolFinancialChargeOrm);

        const charges = await chargeRepo
            .createQueryBuilder('charge')
            .innerJoin('charge.course', 'course')
            .innerJoin('charge.courseClass', 'class')
            .where('charge.schoolId = :schoolId', { schoolId })
            .andWhere('charge.dependentId = :dependentId', { dependentId })
            .andWhere('charge.status NOT IN (:...excludedStatuses)', { excludedStatuses: ['CANCELLED'] })
            .select([
                'charge.id AS charge_id',
                'charge.amountCents AS charge_amount_cents',
                'charge.discountCents AS charge_discount_cents',
                'charge.netAmountCents AS charge_net_amount_cents',
                'charge.description AS charge_description',
                'charge.dueDate AS charge_due_date',
                'charge.paidAt AS charge_paid_at',
                'charge.status AS charge_status',
                'course.id AS course_id',
                'course.name AS course_name',
                'class.id AS class_id',
                'class.label AS class_label'
            ])
            .orderBy('charge.paidAt', 'DESC')
            .addOrderBy('charge.dueDate', 'DESC')
            .getRawMany();

        return charges.map((row: any) => ({
            id: row.charge_id,
            amount: row.charge_amount_cents / 100,
            amountCents: row.charge_amount_cents,
            discount: row.charge_discount_cents != null ? row.charge_discount_cents / 100 : null,
            discountCents: row.charge_discount_cents,
            netAmount: row.charge_net_amount_cents / 100,
            netAmountCents: row.charge_net_amount_cents,
            description: row.charge_description,
            dueDate: new Date(row.charge_due_date),
            paidAt: row.charge_paid_at ? new Date(row.charge_paid_at) : null,
            status: row.charge_status,
            course: {
                id: row.course_id,
                name: row.course_name
            },
            class: {
                id: row.class_id,
                label: row.class_label
            }
        }));
    }
}

