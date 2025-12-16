import { SchoolFinancialChargeRepository } from '../../ports/repositories/school-financial-charge.repo';
import { UserRepository } from '../../ports/repositories/user.repo';
import { DependentRepository } from '../../ports/repositories/dependent.repo';
import { CourseRepository } from '../../ports/repositories/course.repo';
import { CourseClassRepository } from '../../ports/repositories/course-class.repo';
import { AppError, ErrorCode } from '../../shared/errors';

export interface GetStudentPaymentDetailsInput {
    paymentId: string;
    userId: string;
}

export interface GetStudentPaymentDetailsOutput {
    id: string;
    amount: number;
    amountCents: number;
    discount: number | null;
    discountCents: number | null;
    discountReason: string | null;
    netAmount: number;
    netAmountCents: number;
    status: string;
    chargeType: string;
    description: string | null;
    dueDate: Date;
    paidAt: Date | null;
    type: 'PIX' | 'BOLETO' | 'MANUAL' | null;
    pixKey: string | null;
    pixQrCode: string | null;
    pixCopiaECola: string | null;
    boletoUrl: string | null;
    digitableLine: string | null;
    barcode: string | null;
    bankName: string | null;
    bankOrigin: string | null;
    studentName: string;
    studentId: string;
    studentType: 'USER' | 'DEPENDENT';
    courseName: string;
    courseId: string;
    className: string | null;
    classId: string | null;
    asaasPaymentId: string | null;
    createdAt: Date;
    updatedAt: Date;
}

export class GetStudentPaymentDetails {
    constructor(
        private readonly financialCharges: SchoolFinancialChargeRepository,
        private readonly users: UserRepository,
        private readonly dependents: DependentRepository,
        private readonly courses: CourseRepository,
        private readonly classes: CourseClassRepository
    ) {}

    async exec(input: GetStudentPaymentDetailsInput): Promise<GetStudentPaymentDetailsOutput> {
        const paymentId = input.paymentId?.trim();
        const userId = input.userId?.trim();

        if (!paymentId) {
            throw AppError.fromCode(ErrorCode.INVALID_IDENTIFIERS, {
                message: 'ID do pagamento é obrigatório'
            });
        }

        if (!userId) {
            throw AppError.fromCode(ErrorCode.INVALID_IDENTIFIERS, {
                message: 'ID do usuário é obrigatório'
            });
        }

        // Buscar cobrança
        const charge = await this.financialCharges.findById(paymentId);
        if (!charge) {
            throw AppError.fromCode(ErrorCode.CHARGE_NOT_FOUND, {
                paymentId
            });
        }

        // Verificar se o pagamento pertence ao usuário
        if (charge.ownerUserId !== userId) {
            throw AppError.fromCode(ErrorCode.NOT_ALLOWED, {
                message: 'Pagamento não pertence ao usuário',
                paymentId,
                userId
            });
        }

        // Buscar dados do estudante
        let studentName = '';
        let studentId = '';
        let studentType: 'USER' | 'DEPENDENT' = 'USER';

        if (charge.dependentId) {
            const dependent = await this.dependents.findById(charge.dependentId);
            if (dependent) {
                studentName = dependent.fullName;
                studentId = dependent.id;
                studentType = 'DEPENDENT';
            } else {
                // Se não encontrar dependente, usar owner
                const owner = await this.users.findById(charge.ownerUserId);
                if (owner) {
                    studentName = owner.fullName;
                    studentId = owner.id;
                }
            }
        } else if (charge.studentUserId) {
            const student = await this.users.findById(charge.studentUserId);
            if (student) {
                studentName = student.fullName;
                studentId = student.id;
                studentType = 'USER';
            } else {
                // Fallback para owner
                const owner = await this.users.findById(charge.ownerUserId);
                if (owner) {
                    studentName = owner.fullName;
                    studentId = owner.id;
                }
            }
        } else {
            // Fallback para owner
            const owner = await this.users.findById(charge.ownerUserId);
            if (owner) {
                studentName = owner.fullName;
                studentId = owner.id;
            }
        }

        // Buscar dados do curso
        const course = await this.courses.findById(charge.courseId);
        const courseName = course?.name || 'Curso não encontrado';

        // Buscar dados da turma
        let className: string | null = null;
        if (charge.courseClassId) {
            const courseClass = await this.classes.findById(charge.courseClassId);
            className = courseClass?.label || null;
        }

        // Determinar tipo de pagamento
        const paymentType = this.determinePaymentType(charge.asaasPayload, charge.asaasPaymentId, charge.status);

        // Extrair informações do payload
        const payload = charge.asaasPayload || {};
        const pixKey = this.extractPixKey(payload);
        const pixQrCode = typeof payload.pixQrCode === 'string' ? payload.pixQrCode : null;
        const pixCopiaECola = typeof payload.pixCopiaECola === 'string' ? payload.pixCopiaECola : null;
        const digitableLine = typeof payload.digitableLine === 'string' ? payload.digitableLine : null;
        const barcode = typeof payload.barcode === 'string' ? payload.barcode : null;
        const bankName = this.extractBankName(payload);
        const bankOrigin = this.extractBankOrigin(payload);

        return {
            id: charge.id,
            amount: charge.amountCents / 100,
            amountCents: charge.amountCents,
            discount: charge.discountCents ? charge.discountCents / 100 : null,
            discountCents: charge.discountCents,
            discountReason: charge.discountReason,
            netAmount: charge.netAmountCents / 100,
            netAmountCents: charge.netAmountCents,
            status: charge.status,
            chargeType: charge.chargeType,
            description: charge.description,
            dueDate: charge.dueDate,
            paidAt: charge.paidAt,
            type: paymentType,
            pixKey,
            pixQrCode,
            pixCopiaECola,
            boletoUrl: charge.asaasInvoiceUrl,
            digitableLine,
            barcode,
            bankName,
            bankOrigin,
            studentName,
            studentId,
            studentType,
            courseName,
            courseId: charge.courseId,
            className,
            classId: charge.courseClassId,
            asaasPaymentId: charge.asaasPaymentId,
            createdAt: charge.createdAt,
            updatedAt: charge.updatedAt
        };
    }

    private determinePaymentType(
        asaasPayload: Record<string, unknown> | null,
        asaasPaymentId: string | null,
        status: string
    ): 'PIX' | 'BOLETO' | 'MANUAL' | null {
        // Se não está pago, não tem tipo
        if (status !== 'PAID') {
            return null;
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
        return 'MANUAL';
    }

    private extractPixKey(payload: Record<string, unknown>): string | null {
        // Tentar extrair chave PIX de diferentes campos possíveis
        if (typeof payload.pixKey === 'string' && payload.pixKey.trim()) {
            return payload.pixKey.trim();
        }
        if (typeof payload.pixCopiaECola === 'string' && payload.pixCopiaECola.trim()) {
            // O pixCopiaECola pode conter a chave PIX
            return payload.pixCopiaECola.trim();
        }
        // Verificar se há informações de transação PIX
        if (payload.pixTransaction && typeof payload.pixTransaction === 'object') {
            const pixTx = payload.pixTransaction as Record<string, unknown>;
            if (typeof pixTx.endToEndId === 'string') {
                return pixTx.endToEndId;
            }
        }
        return null;
    }

    private extractBankName(payload: Record<string, unknown>): string | null {
        // Tentar extrair nome do banco de diferentes campos
        if (typeof payload.bankName === 'string' && payload.bankName.trim()) {
            return payload.bankName.trim();
        }
        if (payload.pixTransaction && typeof payload.pixTransaction === 'object') {
            const pixTx = payload.pixTransaction as Record<string, unknown>;
            if (typeof pixTx.bankName === 'string' && pixTx.bankName.trim()) {
                return pixTx.bankName.trim();
            }
        }
        return null;
    }

    private extractBankOrigin(payload: Record<string, unknown>): string | null {
        // Tentar extrair banco de origem
        if (typeof payload.bankOrigin === 'string' && payload.bankOrigin.trim()) {
            return payload.bankOrigin.trim();
        }
        if (payload.pixTransaction && typeof payload.pixTransaction === 'object') {
            const pixTx = payload.pixTransaction as Record<string, unknown>;
            if (typeof pixTx.bankName === 'string' && pixTx.bankName.trim()) {
                return pixTx.bankName.trim();
            }
            if (typeof pixTx.bank === 'string' && pixTx.bank.trim()) {
                return pixTx.bank.trim();
            }
        }
        return null;
    }
}

