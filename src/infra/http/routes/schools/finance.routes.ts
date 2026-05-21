import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../utils/async-handler';
import type { CreateSchoolCharge } from '../../../../app/use-cases/schools/create-school-charge';
import type { GetSchoolFinancialSummary } from '../../../../app/use-cases/schools/get-school-financial-summary';
import type { ListSchoolWithdrawals } from '../../../../app/use-cases/schools/list-school-withdrawals';
import type { RequestSchoolWithdrawal } from '../../../../app/use-cases/schools/request-school-withdrawal';
import type { GetSchoolBalance } from '../../../../app/use-cases/schools/get-school-balance';
import type { SchoolRouteGuards } from './guards';
import type { SchoolMarkChargePaid } from '../../../../app/use-cases/schools/school-mark-charge-paid';
import type { SchoolDeleteCharge } from '../../../../app/use-cases/schools/school-delete-charge';
import type { SchoolContextRequest } from '../../middlewares/resolve-school-context';
import type { SchoolFinancialCharge } from '../../../../domain/entities/school-financial-charge';
import type { GenerateTuitionPix } from '../../../../app/use-cases/payments/generate-tuition-pix';
import type { AuthenticatedRequest } from '../../middlewares/auth';
import { UserPersonaEnum } from '../../../../domain/value-objects/user-persona';

const chargeTypes = ['TUITION', 'ENROLLMENT', 'MATERIALS', 'DAILY', 'OTHER'] as const;

const createChargeSchema = z.object({
    studentUserId: z.string().uuid().optional(),
    dependentId: z.string().uuid().optional(),
    courseId: z.string().uuid(),
    courseClassId: z.string().uuid().optional(),
    chargeType: z.enum(chargeTypes),
    description: z.string().trim().max(255).optional(),
    amount: z.number().positive(),
    discount: z.object({
        amount: z.number().positive(),
        reason: z.string().trim().max(255).optional()
    }).optional(),
    dueDate: z.coerce.date()
}).superRefine((data, ctx) => {
    if (!data.studentUserId && !data.dependentId) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['studentUserId'],
            message: 'Informe o aluno ou dependente para a cobrança'
        });
    }
    if (data.discount && data.discount.amount >= data.amount) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['discount', 'amount'],
            message: 'O desconto deve ser menor que o valor da cobrança'
        });
    }
    if (data.discount?.reason && !data.discount?.amount) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['discount', 'reason'],
            message: 'Informe o valor do desconto'
        });
    }
});

const toCents = (value: number) => Math.round(value * 100);
const toCurrency = (valueInCents: number) => Number((valueInCents / 100).toFixed(2));
const formatDate = (date: Date) => date.toISOString().split('T')[0];

const requestWithdrawalSchema = z.object({
    amount: z.number().positive('O valor deve ser maior que zero'),
    bankAccountId: z.string().uuid('ID da conta bancária inválido'),
    otpChallengeId: z.string().uuid('OTP challenge inválido')
});

type FinanceRoutesDeps = {
    createSchoolCharge?: CreateSchoolCharge;
    getSchoolFinancialSummary?: GetSchoolFinancialSummary;
    listSchoolWithdrawals?: ListSchoolWithdrawals;
    requestSchoolWithdrawal?: RequestSchoolWithdrawal;
    getSchoolBalance?: GetSchoolBalance;
    schoolMarkChargePaid?: SchoolMarkChargePaid;
    schoolDeleteCharge?: SchoolDeleteCharge;
    generateTuitionPix?: GenerateTuitionPix;
};

export function buildFinanceRoutes(deps: FinanceRoutesDeps, guards: SchoolRouteGuards) {
    const router = Router();

    const protectedMiddleware = [
        guards.requireAuth,
        guards.requireSchoolPersona,
        guards.resolveSchoolContext
    ] as const;

    if (deps.createSchoolCharge) {
        router.post('/charges', ...protectedMiddleware, asyncHandler(async (req, res) => {
            const schoolId = (req as SchoolContextRequest).schoolId as string;
            const body = createChargeSchema.parse(req.body ?? {});

            const amountCents = toCents(body.amount);
            const discountCents = body.discount ? toCents(body.discount.amount) : null;

            const charge = await deps.createSchoolCharge!.exec({
            schoolId,
            courseId: body.courseId,
            courseClassId: body.courseClassId ?? null,
            studentUserId: body.studentUserId ?? null,
            dependentId: body.dependentId ?? null,
            chargeType: body.chargeType,
            description: body.description ?? null,
            amountCents,
            discountCents,
            discountReason: body.discount?.reason ?? null,
            dueDate: body.dueDate
        });

            res.status(201).json({ charge: serializeCharge(charge) });
        }));
    }

    const markChargePaidSchema = z.object({
        data: z.coerce.date(),
        observacao: z.string().trim().max(500).nullable().optional()
    });

    if (deps.schoolMarkChargePaid) {
        router.post('/charges/:chargeId/mark-paid', ...protectedMiddleware, asyncHandler(async (req, res) => {
            const schoolId = (req as SchoolContextRequest).schoolId as string;
            const params = z.object({ chargeId: z.string().uuid() }).parse(req.params);
            const body = markChargePaidSchema.parse(req.body ?? {});

            const result = await deps.schoolMarkChargePaid!.exec({
                schoolId,
                chargeId: params.chargeId,
                data: body.data,
                observacao: body.observacao ?? null
            });

            res.json(result);
        }));
    }

    if (deps.schoolDeleteCharge) {
        router.delete('/charges/:chargeId', ...protectedMiddleware, asyncHandler(async (req, res) => {
            const schoolId = (req as SchoolContextRequest).schoolId as string;
            const params = z.object({ chargeId: z.string().uuid() }).parse(req.params);

            const result = await deps.schoolDeleteCharge!.exec({
                schoolId,
                chargeId: params.chargeId
            });

            res.json(result);
        }));
    }

    if (deps.generateTuitionPix) {
        router.post('/charges/:chargeId/pix', ...protectedMiddleware, asyncHandler(async (req, res) => {
            const authReq = req as AuthenticatedRequest;
            const schoolId = (req as SchoolContextRequest).schoolId as string;

            if (!authReq.user?.sub) {
                return res.status(401).json({
                    error: 'Não autorizado',
                    code: 'UNAUTHORIZED'
                });
            }

            const params = z.object({ chargeId: z.string().uuid() }).parse(req.params);

            const result = await deps.generateTuitionPix!.exec({
                chargeId: params.chargeId,
                requester: {
                    id: authReq.user.sub,
                    persona: UserPersonaEnum.SCHOOL,
                    schoolId
                }
            });

            res.json(result);
        }));
    }

    if (deps.getSchoolBalance) {
        router.get('/balance', ...protectedMiddleware, asyncHandler(async (req, res) => {
            const schoolId = (req as SchoolContextRequest).schoolId as string;

            const balance = await deps.getSchoolBalance!.exec({ schoolId });

            res.json({
                balance: toCurrency(balance.balanceCents),
                balanceCents: balance.balanceCents,
                availableBalance: toCurrency(balance.availableBalanceCents),
                availableBalanceCents: balance.availableBalanceCents,
                blockedBalance: balance.blockedBalanceCents !== null ? toCurrency(balance.blockedBalanceCents) : null,
                blockedBalanceCents: balance.blockedBalanceCents,
                accountId: balance.accountId,
                hasAsaasAccount: balance.hasAsaasAccount
            });
        }));
    }

    if (deps.getSchoolFinancialSummary) {
        router.get('/summary', ...protectedMiddleware, asyncHandler(async (req, res) => {
            const schoolId = (req as SchoolContextRequest).schoolId as string;

            const summary = await deps.getSchoolFinancialSummary!.exec({ schoolId });

            res.json({
                availableWithdrawals: summary.availableWithdrawals.map((withdrawal) => ({
                    id: withdrawal.id,
                    netAmount: toCurrency(withdrawal.netAmountCents),
                    netAmountCents: withdrawal.netAmountCents,
                    paidAt: formatDate(withdrawal.paidAt),
                    description: withdrawal.description,
                    studentName: withdrawal.studentName,
                    courseName: withdrawal.courseName
                })),
                availableBalance: toCurrency(summary.availableBalanceCents),
                availableBalanceCents: summary.availableBalanceCents,
                totalReceivedThisMonth: toCurrency(summary.totalReceivedThisMonthCents),
                totalReceivedThisMonthCents: summary.totalReceivedThisMonthCents
            });
        }));
    }

    if (deps.listSchoolWithdrawals) {
        const withdrawalsQuerySchema = z.object({
            month: z.coerce.number().int().min(1).max(12).optional(),
            year: z.coerce.number().int().min(2000).max(3000).optional()
        });

        router.get('/withdrawals', ...protectedMiddleware, asyncHandler(async (req, res) => {
            const schoolId = (req as SchoolContextRequest).schoolId as string;

            const query = withdrawalsQuerySchema.parse({
                month: req.query.month,
                year: req.query.year
            });

            const result = await deps.listSchoolWithdrawals!.exec({
                schoolId,
                month: query.month,
                year: query.year
            });

            res.json({
                withdrawals: result.withdrawals.map((withdrawal) => ({
                    id: withdrawal.id,
                    amount: toCurrency(withdrawal.amountCents),
                    amountCents: withdrawal.amountCents,
                    bankName: withdrawal.bankName,
                    bankAgency: withdrawal.bankAgency,
                    bankAccount: withdrawal.bankAccount,
                    pixKey: withdrawal.pixKey,
                    status: withdrawal.status,
                    createdAt: formatDate(withdrawal.createdAt),
                    processedAt: withdrawal.processedAt ? formatDate(withdrawal.processedAt) : null,
                    cancelledAt: withdrawal.cancelledAt ? formatDate(withdrawal.cancelledAt) : null
                }))
            });
        }));
    }

    if (deps.requestSchoolWithdrawal) {
        router.post('/withdrawals', ...protectedMiddleware, asyncHandler(async (req, res) => {
            const schoolId = (req as SchoolContextRequest).schoolId as string;
            const body = requestWithdrawalSchema.parse(req.body);

            const result = await deps.requestSchoolWithdrawal!.exec({
                schoolId,
                amount: body.amount,
                bankAccountId: body.bankAccountId,
                otpChallengeId: body.otpChallengeId
            });

            res.status(201).json({
                id: result.withdrawalId,
                amount: result.amount,
                amountCents: result.amountCents,
                status: result.status
            });
        }));
    }

    return router;
}

function serializeCharge(charge: SchoolFinancialCharge) {
    return {
        id: charge.id,
        schoolId: charge.schoolId,
        ownerUserId: charge.ownerUserId,
        studentUserId: charge.studentUserId,
        dependentId: charge.dependentId,
        courseId: charge.courseId,
        courseClassId: charge.courseClassId,
        chargeType: charge.chargeType,
        description: charge.description,
        amount: toCurrency(charge.amountCents),
        discount: charge.discountCents !== null
            ? {
                amount: toCurrency(charge.discountCents),
                reason: charge.discountReason
            }
            : null,
        netAmount: toCurrency(charge.netAmountCents),
        dueDate: formatDate(charge.dueDate),
        status: charge.status,
        asaasPaymentId: charge.asaasPaymentId,
        asaasInvoiceUrl: charge.asaasInvoiceUrl,
        createdAt: charge.createdAt.toISOString(),
        updatedAt: charge.updatedAt.toISOString()
    };
}
