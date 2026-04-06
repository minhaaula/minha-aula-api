import { AppDataSource } from '../../infra/db/typeorm/datasource';
import { SchoolFinancialChargeOrm } from '../../infra/db/typeorm/entities/school-financial-charge.orm';
import { CourseRepository } from '../../ports/repositories/course.repo';
import { CourseClassRepository } from '../../ports/repositories/course-class.repo';
import { UserRepository } from '../../ports/repositories/user.repo';
import { DependentRepository } from '../../ports/repositories/dependent.repo';
import { equalUuid } from '../../shared/normalize-uuid';
import { formatSchoolChargeDescriptionForSchoolUi } from '../../shared/format-school-charge-description';
import { isOpenChargeCalendarOverdue } from '../../shared/billing-due-date';
import { SchoolFinancialChargeStatus } from '../../domain/entities/school-financial-charge';
import type { ListSchoolPaymentsInput, SchoolPaymentRecord, SchoolPaymentStatusDisplay } from '../types/payment.types';

export type { SchoolPaymentRecord };

export class ListSchoolPayments {
    constructor(
        private readonly courses: CourseRepository,
        private readonly classes: CourseClassRepository,
        private readonly users: UserRepository,
        private readonly dependents: DependentRepository
    ) {}

    async exec(input: ListSchoolPaymentsInput): Promise<SchoolPaymentRecord[]> {
        const schoolId = input.schoolId?.trim();
        const month = input.month;
        const year = input.year;
        const classIdFilter = input.classId?.trim() || null;
        const studentNameFilter = input.studentName?.trim().toLowerCase() || null;
        const statusFilter = input.status?.trim() || null;

        if (!schoolId) return [];
        if (!month || month < 1 || month > 12) throw new Error('Month must be between 1 and 12');
        if (!year || year < 2000 || year > 3000) throw new Error('Year must be a valid year');

        // Resolve courses and classes for the school
        const courses = await this.resolveCourses(schoolId, classIdFilter);
        if (!courses || courses.length === 0) {
            return [];
        }

        const classes = await this.resolveClasses(courses, classIdFilter);
        if (!classes || classes.length === 0) {
            return [];
        }

        const classIds = classes.map((cls) => cls.id);
        const courseIds = courses.map((course) => course.id);

        // Query financial charges
        const queryBuilder = AppDataSource.getRepository(SchoolFinancialChargeOrm)
            .createQueryBuilder('charge')
            .leftJoin('charge.ownerUser', 'owner')
            .leftJoin('charge.student', 'studentUser')
            .leftJoin('charge.dependent', 'dependent')
            .leftJoin('charge.course', 'course')
            .leftJoin('charge.courseClass', 'courseClass')
            .where('charge.schoolId = :schoolId', { schoolId })
            .andWhere('charge.courseId IN (:...courseIds)', { courseIds })
            .andWhere('YEAR(charge.dueDate) = :year', { year })
            .andWhere('MONTH(charge.dueDate) = :month', { month })
            .select([
                'charge.id AS charge_id',
                'charge.amountCents AS charge_amount_cents',
                'charge.discountCents AS charge_discount_cents',
                'charge.discountReason AS charge_discount_reason',
                'charge.netAmountCents AS charge_net_amount_cents',
                'charge.status AS charge_status',
                'charge.chargeType AS charge_charge_type',
                'charge.description AS charge_description',
                'charge.dueDate AS charge_due_date',
                'charge.asaasPaymentId AS charge_asaas_payment_id',
                'charge.asaasInvoiceUrl AS charge_asaas_invoice_url',
                'charge.asaasPayload AS charge_asaas_payload',
                'charge.paidAt AS charge_paid_at',
                'charge.paymentMethod AS charge_payment_method',
                'charge.createdAt AS charge_created_at',
                'charge.updatedAt AS charge_updated_at',
                'charge.studentUserId AS charge_student_user_id',
                'charge.dependentId AS charge_dependent_id',
                'charge.ownerUserId AS charge_owner_user_id',
                'charge.courseClassId AS charge_course_class_id',
                'course.id AS course_id',
                'course.name AS course_name',
                'courseClass.id AS class_id',
                'courseClass.label AS class_label',
                'owner.id AS owner_id',
                'owner.fullName AS owner_full_name',
                'studentUser.id AS student_user_id',
                'studentUser.fullName AS student_user_full_name',
                'dependent.id AS dependent_id',
                'dependent.fullName AS dependent_full_name'
            ]);

        if (classIdFilter) {
            queryBuilder.andWhere('charge.courseClassId = :classId', { classId: classIdFilter });
        }

        if (statusFilter) {
            queryBuilder.andWhere('charge.status = :status', { status: statusFilter });
        }

        if (studentNameFilter) {
            queryBuilder.andWhere(
                '(LOWER(owner.fullName) LIKE :name OR LOWER(studentUser.fullName) LIKE :name OR LOWER(dependent.fullName) LIKE :name)',
                { name: `%${studentNameFilter}%` }
            );
        }

        const charges = await queryBuilder.getRawMany();

        // Collect unique IDs for batch loading
        const ownerIds = new Set<string>();
        const studentUserIds = new Set<string>();
        const dependentIds = new Set<string>();

        for (const row of charges) {
            if (row.charge_owner_user_id) ownerIds.add(row.charge_owner_user_id);
            if (row.charge_student_user_id) studentUserIds.add(row.charge_student_user_id);
            if (row.charge_dependent_id) dependentIds.add(row.charge_dependent_id);
        }

        // Batch load all users and dependents
        const ownersMap = new Map<string, any>();
        const studentUsersMap = new Map<string, any>();
        const dependentsMap = new Map<string, any>();

        await Promise.all([
            ...Array.from(ownerIds).map(async (id) => {
                const user = await this.users.findById(id);
                if (user) ownersMap.set(id, user);
            }),
            ...Array.from(studentUserIds).map(async (id) => {
                const user = await this.users.findById(id);
                if (user) studentUsersMap.set(id, user);
            })
        ]);

        if (dependentIds.size > 0) {
            const allDependents = await this.dependents.findByUserIds(Array.from(ownerIds));
            for (const dep of allDependents) {
                if (dependentIds.has(dep.id)) {
                    dependentsMap.set(dep.id, dep);
                }
            }
        }

        // Build results
        const results: SchoolPaymentRecord[] = [];

        for (const row of charges) {
            const ownerId = row.charge_owner_user_id;
            const owner = ownersMap.get(ownerId);
            if (!owner) continue;

            let studentName = owner.fullName;
            let studentId = row.charge_student_user_id || row.charge_dependent_id;
            let studentType: 'USER' | 'DEPENDENT' = row.charge_student_user_id ? 'USER' : 'DEPENDENT';
            let dependent = null;

            if (row.charge_dependent_id) {
                const dep = dependentsMap.get(row.charge_dependent_id);
                if (dep) {
                    studentName = dep.fullName;
                    studentId = dep.id;
                    dependent = {
                        id: dep.id,
                        fullName: dep.fullName
                    };
                }
            } else if (row.charge_student_user_id) {
                const student = studentUsersMap.get(row.charge_student_user_id);
                if (student) {
                    studentName = student.fullName;
                }
            }

            // Determinar tipo de pagamento: usar valor persistido (baixa manual) ou inferir do payload
            const paymentType = this.determinePaymentType(
                row.charge_asaas_payload,
                row.charge_asaas_payment_id,
                row.charge_status,
                row.charge_payment_method
            );

            // Converter datas para Date se forem strings
            const convertToDate = (value: any): Date => {
                if (value instanceof Date) return value;
                if (!value) return value;
                return new Date(value);
            };

            const paidAt = row.charge_paid_at ? convertToDate(row.charge_paid_at) : null;
            const dueDate = convertToDate(row.charge_due_date);
            const createdAt = convertToDate(row.charge_created_at);
            const updatedAt = convertToDate(row.charge_updated_at);

            const status = row.charge_status as SchoolFinancialChargeStatus;
            results.push({
                id: row.charge_id,
                amountCents: row.charge_amount_cents,
                discountCents: row.charge_discount_cents,
                discountReason: row.charge_discount_reason,
                netAmountCents: row.charge_net_amount_cents,
                status,
                statusDisplay: this.getStatusDisplay(status, dueDate),
                chargeType: row.charge_charge_type,
                description: formatSchoolChargeDescriptionForSchoolUi(
                    row.charge_charge_type,
                    row.charge_description,
                    row.course_name
                ),
                dueDate,
                asaasPaymentId: row.charge_asaas_payment_id,
                asaasInvoiceUrl: row.charge_asaas_invoice_url,
                paidAt,
                type: paymentType,
                createdAt,
                updatedAt,
                student: {
                    id: studentId || ownerId,
                    fullName: studentName,
                    type: studentType
                },
                dependent,
                course: {
                    id: row.course_id,
                    name: row.course_name
                },
                class: row.class_id ? {
                    id: row.class_id,
                    label: row.class_label
                } : null
            });
        }

        const statusRank = (item: SchoolPaymentRecord): number => {
            // Ordenação pedida: Atrasado primeiro, depois Pendente, depois os demais
            if (item.statusDisplay === 'Atrasado') return 0;
            if (item.statusDisplay === 'Pendente') return 1;
            return 2;
        };

        return results.sort((a, b) => {
            const byStatus = statusRank(a) - statusRank(b);
            if (byStatus !== 0) return byStatus;

            // Mesmo grupo de status: vencimento mais recente (data mais “à frente”) primeiro
            const byDueDate = b.dueDate.getTime() - a.dueDate.getTime();
            if (byDueDate !== 0) return byDueDate;

            return b.createdAt.getTime() - a.createdAt.getTime();
        });
    }

    private async resolveCourses(
        schoolId: string,
        classIdFilter: string | null
    ): Promise<any[] | null> {
        if (classIdFilter) {
            const courseClass = await this.classes.findById(classIdFilter);
            if (!courseClass || !courseClass.isActive) return null;
            const course = await this.courses.findById(courseClass.courseId);
            if (!course || !course.isActive || !equalUuid(course.schoolId, schoolId)) return null;
            return [course];
        }

        const courses = await this.courses.findBySchoolId(schoolId);
        return courses.filter((course) => course.isActive);
    }

    private async resolveClasses(courses: any[], classIdFilter: string | null): Promise<any[] | null> {
        if (!courses.length) return null;
        const courseIds = courses.map((course) => course.id);

        if (classIdFilter) {
            const courseClass = await this.classes.findById(classIdFilter);
            if (!courseClass || !courseClass.isActive) return null;
            if (!courseIds.some((id) => equalUuid(id, courseClass.courseId))) return null;
            return [courseClass];
        }

        const classes = await this.classes.findByCourseIds(courseIds);
        return classes.filter((cls) => cls.isActive);
    }

    private determinePaymentType(
        asaasPayload: any,
        asaasPaymentId: string | null,
        status: string,
        storedPaymentMethod: string | null | undefined
    ): 'PIX' | 'BOLETO' | 'MANUAL' | null {
        // Se não está pago, não tem tipo
        if (status !== 'PAID') {
            return null;
        }

        // Prioridade ao método persistido (ex.: baixa manual pelo site grava MANUAL)
        if (storedPaymentMethod === 'MANUAL' || storedPaymentMethod === 'PIX' || storedPaymentMethod === 'BOLETO') {
            return storedPaymentMethod;
        }

        // Se não tem paymentId, provavelmente foi pago manualmente
        if (!asaasPaymentId) {
            return 'MANUAL';
        }

        // Verificar payload para determinar tipo
        if (asaasPayload && typeof asaasPayload === 'object') {
            // Verificar se tem dados de PIX
            if (asaasPayload.pixQrCode || asaasPayload.pixCopiaECola) {
                return 'PIX';
            }
            
            // Verificar se tem dados de boleto
            if (asaasPayload.digitableLine || asaasPayload.barcode) {
                return 'BOLETO';
            }

            // Verificar billingType do Asaas se disponível
            if (asaasPayload.billingType) {
                const billingType = String(asaasPayload.billingType).toUpperCase();
                if (billingType === 'PIX') {
                    return 'PIX';
                }
                if (billingType === 'BOLETO' || billingType === 'BANK_SLIP') {
                    return 'BOLETO';
                }
            }
        }

        // Se tem paymentId mas não conseguimos determinar o tipo, assume manual
        // (pode ser que foi pago via outro método ou o payload não está completo)
        return 'MANUAL';
    }

    /** Status para exibição: Pendente, Atrasado, Pago, Cancelado, Falhou. */
    private getStatusDisplay(status: SchoolFinancialChargeStatus, dueDate: Date): SchoolPaymentStatusDisplay {
        if (status === 'OPEN' || status === 'PENDING_SYNC') {
            if (isOpenChargeCalendarOverdue(new Date(dueDate))) return 'Atrasado';
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
