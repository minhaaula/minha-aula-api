import type { PostalAddressProps } from '../../domain/value-objects/postal-address';
import { UserRepository } from '../../ports/repositories/user.repo';
import { DependentRepository } from '../../ports/repositories/dependent.repo';
import { AppDataSource } from '../../infra/db/typeorm/datasource';
import { EnrollmentOrm } from '../../infra/db/typeorm/entities/enrollment.orm';
import { SchoolFinancialChargeOrm } from '../../infra/db/typeorm/entities/school-financial-charge.orm';
import { AppError, ErrorCode } from '../../shared/errors';
import { formatSchoolChargeDescriptionForSchoolUi } from '../../shared/format-school-charge-description';

export interface GetAdminStudentDetailsInput {
    studentId: string;
}

type EnrollmentItem = {
    id: string;
    school: { id: string; name: string };
    course: { id: string; name: string };
    class: { id: string; label: string };
    enrolledAt: Date;
    status: string;
};

type PaidChargeItem = {
    id: string;
    school: { id: string; name: string };
    amount: number;
    amountCents: number;
    discount: number | null;
    discountCents: number | null;
    netAmount: number;
    netAmountCents: number;
    description: string | null;
    dueDate: Date;
    paidAt: Date;
    course: { id: string; name: string };
    class: { id: string; label: string };
};

export type AdminStudentDependentItem = {
    id: string;
    fullName: string;
    cpf: string | null;
    birthDate: Date | null;
    relationship: string | null;
    enrollments: EnrollmentItem[];
};

export interface GetAdminStudentDetailsOutput {
    student: {
        id: string;
        fullName: string;
        email: string;
        phone: string;
        cpf: string;
        birthDate: Date | null;
        studentType: 'USER' | 'DEPENDENT';
        endereco: PostalAddressProps;
    };
    responsible: {
        id: string;
        fullName: string;
        email: string;
        phone: string;
        cpf: string;
    } | null;
    enrollments: EnrollmentItem[];
    paidCharges: PaidChargeItem[];
    dependents: AdminStudentDependentItem[];
}

export class GetAdminStudentDetails {
    constructor(
        private readonly users: UserRepository,
        private readonly dependents: DependentRepository
    ) {}

    async exec(input: GetAdminStudentDetailsInput): Promise<GetAdminStudentDetailsOutput | null> {
        const studentId = input.studentId.trim();
        if (!studentId) {
            throw AppError.fromCode(ErrorCode.INVALID_IDENTIFIERS, {
                message: 'studentId é obrigatório'
            });
        }

        const user = await this.users.findById(studentId);
        if (user) {
            const [enrollments, paidCharges, dependentsList] = await Promise.all([
                this.findEnrollmentsForUser(user.id),
                this.findPaidChargesForUser(user.id),
                this.dependents.findByUserIds([user.id])
            ]);

            const dependents: AdminStudentDependentItem[] = [];
            for (const dep of dependentsList) {
                const depEnrollments = await this.findEnrollmentsForDependent(dep.id);
                dependents.push({
                    id: dep.id,
                    fullName: dep.fullName,
                    cpf: dep.cpf,
                    birthDate: dep.birthDate,
                    relationship: dep.relationship,
                    enrollments: depEnrollments
                });
            }

            return {
                student: {
                    id: user.id,
                    fullName: user.fullName,
                    email: user.email.value,
                    phone: user.phone,
                    cpf: user.cpf,
                    birthDate: user.birthDate,
                    studentType: 'USER',
                    endereco: user.address.toPrimitives()
                },
                responsible: null,
                enrollments,
                paidCharges,
                dependents
            };
        }

        const dependent = await this.dependents.findById(studentId);
        if (!dependent) {
            return null;
        }

        const responsible = await this.users.findById(dependent.userId);
        if (!responsible) {
            return null;
        }

        const [enrollments, paidCharges] = await Promise.all([
            this.findEnrollmentsForDependent(dependent.id),
            this.findPaidChargesForDependent(dependent.id)
        ]);

        return {
            student: {
                id: dependent.id,
                fullName: dependent.fullName,
                email: '',
                phone: '',
                cpf: dependent.cpf || '',
                birthDate: dependent.birthDate,
                studentType: 'DEPENDENT',
                endereco: responsible.address.toPrimitives()
            },
            responsible: {
                id: responsible.id,
                fullName: responsible.fullName,
                email: responsible.email.value,
                phone: responsible.phone,
                cpf: responsible.cpf
            },
            enrollments,
            paidCharges,
            dependents: []
        };
    }

    private async findEnrollmentsForUser(userId: string): Promise<EnrollmentItem[]> {
        const repo = AppDataSource.getRepository(EnrollmentOrm);
        const rows = await repo
            .createQueryBuilder('enrollment')
            .innerJoin('enrollment.courseClass', 'class')
            .innerJoin('class.course', 'course')
            .innerJoin('course.school', 'school')
            .where('enrollment.studentUserId = :userId', { userId })
            .select([
                'enrollment.id',
                'enrollment.enrolledAt',
                'enrollment.status',
                'course.id',
                'course.name',
                'class.id',
                'class.label',
                'school.id',
                'school.name'
            ])
            .orderBy('enrollment.enrolledAt', 'DESC')
            .getRawMany();
        return rows.map((row: any) => ({
            id: row.enrollment_id,
            school: { id: row.school_id, name: row.school_name },
            course: { id: row.course_id, name: row.course_name },
            class: { id: row.class_id, label: row.class_label },
            enrolledAt: row.enrollment_enrolled_at,
            status: row.enrollment_status
        }));
    }

    private async findEnrollmentsForDependent(dependentId: string): Promise<EnrollmentItem[]> {
        const repo = AppDataSource.getRepository(EnrollmentOrm);
        const rows = await repo
            .createQueryBuilder('enrollment')
            .innerJoin('enrollment.courseClass', 'class')
            .innerJoin('class.course', 'course')
            .innerJoin('course.school', 'school')
            .where('enrollment.dependentId = :dependentId', { dependentId })
            .select([
                'enrollment.id',
                'enrollment.enrolledAt',
                'enrollment.status',
                'course.id',
                'course.name',
                'class.id',
                'class.label',
                'school.id',
                'school.name'
            ])
            .orderBy('enrollment.enrolledAt', 'DESC')
            .getRawMany();
        return rows.map((row: any) => ({
            id: row.enrollment_id,
            school: { id: row.school_id, name: row.school_name },
            course: { id: row.course_id, name: row.course_name },
            class: { id: row.class_id, label: row.class_label },
            enrolledAt: row.enrollment_enrolled_at,
            status: row.enrollment_status
        }));
    }

    private async findPaidChargesForUser(userId: string): Promise<PaidChargeItem[]> {
        const repo = AppDataSource.getRepository(SchoolFinancialChargeOrm);
        const rows = await repo
            .createQueryBuilder('charge')
            .innerJoin('charge.school', 'school')
            .innerJoin('charge.course', 'course')
            .innerJoin('charge.courseClass', 'class')
            .where('charge.studentUserId = :userId', { userId })
            .andWhere('charge.status = :status', { status: 'PAID' })
            .andWhere('charge.paidAt IS NOT NULL')
            .select([
                'charge.id AS charge_id',
                'charge.amountCents AS charge_amount_cents',
                'charge.discountCents AS charge_discount_cents',
                'charge.netAmountCents AS charge_net_amount_cents',
                'charge.description AS charge_description',
                'charge.chargeType AS charge_charge_type',
                'charge.dueDate AS charge_due_date',
                'charge.paidAt AS charge_paid_at',
                'school.id AS school_id',
                'school.name AS school_name',
                'course.id AS course_id',
                'course.name AS course_name',
                'class.id AS class_id',
                'class.label AS class_label'
            ])
            .orderBy('charge.paidAt', 'DESC')
            .getRawMany();
        return rows.map((row: any) => this.mapChargeRow(row));
    }

    private async findPaidChargesForDependent(dependentId: string): Promise<PaidChargeItem[]> {
        const repo = AppDataSource.getRepository(SchoolFinancialChargeOrm);
        const rows = await repo
            .createQueryBuilder('charge')
            .innerJoin('charge.school', 'school')
            .innerJoin('charge.course', 'course')
            .innerJoin('charge.courseClass', 'class')
            .where('charge.dependentId = :dependentId', { dependentId })
            .andWhere('charge.status = :status', { status: 'PAID' })
            .andWhere('charge.paidAt IS NOT NULL')
            .select([
                'charge.id AS charge_id',
                'charge.amountCents AS charge_amount_cents',
                'charge.discountCents AS charge_discount_cents',
                'charge.netAmountCents AS charge_net_amount_cents',
                'charge.description AS charge_description',
                'charge.chargeType AS charge_charge_type',
                'charge.dueDate AS charge_due_date',
                'charge.paidAt AS charge_paid_at',
                'school.id AS school_id',
                'school.name AS school_name',
                'course.id AS course_id',
                'course.name AS course_name',
                'class.id AS class_id',
                'class.label AS class_label'
            ])
            .orderBy('charge.paidAt', 'DESC')
            .getRawMany();
        return rows.map((row: any) => this.mapChargeRow(row));
    }

    private mapChargeRow(row: any): PaidChargeItem {
        return {
            id: row.charge_id,
            school: { id: row.school_id, name: row.school_name ?? '' },
            amount: row.charge_amount_cents / 100,
            amountCents: row.charge_amount_cents,
            discount: row.charge_discount_cents ? row.charge_discount_cents / 100 : null,
            discountCents: row.charge_discount_cents,
            netAmount: row.charge_net_amount_cents / 100,
            netAmountCents: row.charge_net_amount_cents,
            description: formatSchoolChargeDescriptionForSchoolUi(
                row.charge_charge_type,
                row.charge_description,
                row.course_name
            ),
            dueDate: new Date(row.charge_due_date),
            paidAt: new Date(row.charge_paid_at),
            course: { id: row.course_id, name: row.course_name },
            class: { id: row.class_id, label: row.class_label }
        };
    }
}
