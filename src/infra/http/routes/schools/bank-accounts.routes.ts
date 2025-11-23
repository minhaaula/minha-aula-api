import { Router } from 'express';
import { asyncHandler } from '../../utils/async-handler';
import type { ListSchoolBankAccounts } from '../../../../app/use-cases/list-school-bank-accounts';
import type { CreateSchoolBankAccount } from '../../../../app/use-cases/create-school-bank-account';
import type { UpdateSchoolBankAccount } from '../../../../app/use-cases/update-school-bank-account';
import type { DeleteSchoolBankAccount } from '../../../../app/use-cases/delete-school-bank-account';
import { createBankAccountSchema, updateBankAccountSchema } from '../../validators/bank-account-schemas';
import type { SchoolRouteGuards } from './guards';
import type { SchoolContextRequest } from '../../middlewares/resolve-school-context';

type BankAccountsRoutesDeps = {
    listSchoolBankAccounts?: ListSchoolBankAccounts;
    createSchoolBankAccount?: CreateSchoolBankAccount;
    updateSchoolBankAccount?: UpdateSchoolBankAccount;
    deleteSchoolBankAccount?: DeleteSchoolBankAccount;
};

export function buildBankAccountsRoutes(deps: BankAccountsRoutesDeps, guards: SchoolRouteGuards) {
    const router = Router();

    if (deps.listSchoolBankAccounts) {
        router.get('/', guards.requireAuth, guards.requireSchoolPersona, guards.resolveSchoolContext, asyncHandler(async (req, res) => {
            const schoolId = (req as SchoolContextRequest).schoolId as string;
            const activeOnly = req.query.activeOnly === 'true';
            const result = await deps.listSchoolBankAccounts!.exec({ schoolId, activeOnly });
            res.json(result);
        }));
    }

    if (deps.createSchoolBankAccount) {
        router.post('/', guards.requireAuth, guards.requireSchoolPersona, guards.resolveSchoolContext, asyncHandler(async (req, res) => {
            const schoolId = (req as SchoolContextRequest).schoolId as string;
            const data = createBankAccountSchema.parse(req.body);
            const result = await deps.createSchoolBankAccount!.exec({
                schoolId,
                bankName: data.bankName,
                bankCode: data.banco,
                bankAgency: data.bankAgency,
                bankAgencyDigit: data.digitoAgencia,
                bankAccount: data.bankAccount,
                bankAccountDigit: data.digitoConta,
                bankAccountType: data.bankAccountType,
                bankAccountHolderDocument: data.bankAccountHolderDocument,
                pixKey: data.PIX
            });
            res.status(201).json(result);
        }));
    }

    if (deps.updateSchoolBankAccount) {
        router.put('/:accountId', guards.requireAuth, guards.requireSchoolPersona, guards.resolveSchoolContext, asyncHandler(async (req, res) => {
            const schoolId = (req as SchoolContextRequest).schoolId as string;
            const accountId = req.params.accountId;
            const data = updateBankAccountSchema.parse(req.body ?? {});
            const result = await deps.updateSchoolBankAccount!.exec({
                accountId,
                schoolId,
                bankName: data.bankName,
                bankCode: data.banco,
                bankAgency: data.bankAgency,
                bankAgencyDigit: data.digitoAgencia,
                bankAccount: data.bankAccount,
                bankAccountDigit: data.digitoConta,
                bankAccountType: data.bankAccountType,
                bankAccountHolderDocument: data.bankAccountHolderDocument,
                pixKey: data.PIX,
                isActive: data.isActive
            });
            res.json(result);
        }));
    }

    if (deps.deleteSchoolBankAccount) {
        router.delete('/:accountId', guards.requireAuth, guards.requireSchoolPersona, guards.resolveSchoolContext, asyncHandler(async (req, res) => {
            const schoolId = (req as SchoolContextRequest).schoolId as string;
            const accountId = req.params.accountId;
            await deps.deleteSchoolBankAccount!.exec({ accountId, schoolId });
            res.status(204).send();
        }));
    }

    return router;
}

