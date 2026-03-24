import { UserRepository } from '../../ports/repositories/user.repo';
import { DependentRepository } from '../../ports/repositories/dependent.repo';
import { AppDataSource } from '../../infra/db/typeorm/datasource';
import { EnrollmentOrm } from '../../infra/db/typeorm/entities/enrollment.orm';
import { SchoolFinancialChargeOrm } from '../../infra/db/typeorm/entities/school-financial-charge.orm';
import { SchoolFinancialChargeStatus } from '../../domain/entities/school-financial-charge';
import type { Dependent } from '../../domain/entities/dependent';
import type { User } from '../../domain/entities/user';
import type { SchoolPaymentStatusDisplay } from '../types/payment.types';
import { AppError, ErrorCode } from '../../shared/errors';
import { equalUuid } from '../../shared/normalize-uuid';

export interface GetSchoolStudentDetailsInput {
    schoolId: string;
    studentId: string;
    /**
     * Quando `studentId` é o ID do responsável (titular), informe o UUID do dependente
     * para carregar os detalhes do dependente em vez do titular.
     */
    dependentId?: string | null;
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
        statusDisplay: SchoolPaymentStatusDisplay;
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
        private readonly dependents: DependentRepository
    ) {}

    async exec(input: GetSchoolStudentDetailsInput): Promise<GetSchoolStudentDetailsOutput | null> {
        const schoolId = input.schoolId.trim();
        const studentId = input.studentId.trim();
        const dependentIdParam = input.dependentId?.trim() || null;

        if (!schoolId || !studentId) {
            throw AppError.fromCode(ErrorCode.INVALID_IDENTIFIERS, {
                message: 'schoolId e studentId são obrigatórios'
            });
        }

        // Titular + dependente na query (ex.: app usa student.id do titular na URL)
        if (dependentIdParam) {
            const dependent = await this.dependents.findById(dependentIdParam);
            if (!dependent || !equalUuid(dependent.userId, studentId)) {
                return null;
            }
            const hasEnrollment = await this.checkStudentEnrollmentInSchool(schoolId, dependent.id);
            if (!hasEnrollment) {
                return null;
            }
            return this.buildOutputForDependent(schoolId, dependent);
        }

        const hasEnrollment = await this.checkStudentEnrollmentInSchool(schoolId, studentId);
        if (!hasEnrollment) {
            return null;
        }

        // Priorizar dependente: o UUID em `student` da listagem para matrícula DEPENDENT é o dependente
        const dependent = await this.dependents.findById(studentId);
        if (dependent) {
            return this.buildOutputForDependent(schoolId, dependent);
        }

        const user = await this.users.findById(studentId);
        if (!user) {
            throw AppError.fromCode(ErrorCode.STUDENT_NOT_FOUND, { studentId });
        }

        return this.buildOutputForUser(schoolId, user);
    }

    private async buildOutputForDependent(
        schoolId: string,
        dependent: Dependent
    ): Promise<GetSchoolStudentDetailsOutput> {
        const responsible = await this.users.findById(dependent.userId);
        if (!responsible) {
            throw AppError.fromCode(ErrorCode.USER_NOT_FOUND, { userId: dependent.userId });
        }

        const enrollments = await this.findEnrollmentsForDependent(schoolId, dependent.id);
        const paidCharges = await this.findPaidChargesForDependent(schoolId, dependent.id);

        return {
            student: {
                id: dependent.id,
                fullName: dependent.fullName,
                email: '',
                phone: '',
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

    private async buildOutputForUser(schoolId: string, user: User): Promise<GetSchoolStudentDetailsOutput> {
        const enrollments = await this.findEnrollmentsForUser(schoolId, user.id);
        const paidCharges = await this.findPaidChargesForUser(schoolId, user.id);

        return {
            student: {
                id: user.id,
                fullName: user.fullName,
                email: user.email.value,
                phone: user.phone,
                cpf: user.cpf,
                birthDate: user.birthDate
            },
            responsible: null,
            enrollments,
            paidCharges
        };
    }

    private async checkStudentEnrollmentInSchool(schoolId: string, studentId: string): Promise<boolean> {
        const enrollmentRepo = AppDataSource.getRepository(EnrollmentOrm);

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
            statusDisplay: this.getStatusDisplay(row.charge_status as SchoolFinancialChargeStatus, new Date(row.charge_due_date)),
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
            statusDisplay: this.getStatusDisplay(row.charge_status as SchoolFinancialChargeStatus, new Date(row.charge_due_date)),
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

    /** Status para exibição: Pendente, Atrasado, Pago, Cancelado, Falhou. */
    private getStatusDisplay(status: SchoolFinancialChargeStatus, dueDate: Date): SchoolPaymentStatusDisplay {
        if (status === 'OPEN' || status === 'PENDING_SYNC') {
            const today = new Date();
            const todayUtc = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
            const d = new Date(dueDate);
            const dueUtc = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
            if (dueUtc < todayUtc) return 'Atrasado';
            return 'Pendente';
        }
        const map: Record<SchoolFinancialChargeStatus, SchoolPaymentStatusDisplay> = {
            PENDING_SYNC: 'Pendente',
            OPEN: 'Pendente',
            OVERDUE: 'Atrasado',
            PAID: 'Pago',
            CANCELLED: 'Cancelado',
            FAILED: 'Falhou'
        };
        return map[status] ?? 'Pendente';
    }
}
