import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../utils/async-handler';
import type { ListSchoolStudents } from '../../../../app/use-cases/list-school-students';
import type { GetStudentDirectoryEntry } from '../../../../app/use-cases/get-student-directory-entry';
import type { SchoolRouteGuards } from './guards';
import type { SchoolContextRequest } from '../../middlewares/resolve-school-context';

import type { GetSchoolStudentDetails } from '../../../../app/use-cases/get-school-student-details';
import type { ConsolidateSchoolStudentFinancial } from '../../../../app/use-cases/consolidate-school-student-financial';

type StudentsRoutesDeps = {
    listSchoolStudents: ListSchoolStudents;
    getStudentDirectoryEntry?: GetStudentDirectoryEntry;
    getSchoolStudentDetails?: GetSchoolStudentDetails;
    consolidateSchoolStudentFinancial?: ConsolidateSchoolStudentFinancial;
};

export function buildStudentsRoutes(deps: StudentsRoutesDeps, guards: SchoolRouteGuards) {
    const router = Router();

    const protectedMiddleware = [
        guards.requireAuth,
        guards.requireSchoolPersona,
        guards.resolveSchoolContext
    ] as const;

    // Registrar rota /directory/:cpf ANTES da rota / para evitar conflitos
    if (deps.getStudentDirectoryEntry) {
        router.get('/directory/:cpf', ...protectedMiddleware, asyncHandler(async (req, res) => {
            const paramsSchema = z.object({ cpf: z.string().trim().min(1) });
            const { cpf } = paramsSchema.parse(req.params);

            try {
                const entry = await deps.getStudentDirectoryEntry!.exec({ cpf });
                if (!entry) {
                    return res.status(404).json({ 
                        error: 'Aluno não encontrado',
                        code: 'STUDENT_NOT_FOUND'
                    });
                }

                const serialize = (person: { id: string; name: string; cpf: string; birthDate: Date | null; }) => ({
                    id: person.id,
                    name: person.name,
                    cpf: person.cpf,
                    birthDate: person.birthDate ? person.birthDate.toISOString().slice(0, 10) : null
                });

                res.json({
                    student: serialize(entry.student),
                    responsible: entry.responsible ? serialize(entry.responsible) : null
                });
            } catch (execErr) {
                // Capturar erro de CPF inválido do use case
                if (execErr instanceof Error && execErr.message === 'Invalid CPF') {
                    return res.status(400).json({ 
                        error: 'CPF inválido. Deve conter 11 dígitos',
                        code: 'INVALID_CPF'
                    });
                }
                throw execErr;
            }
        }));
    }

    const querySchema = z.object({
        name: z.string().trim().min(1).optional(),
        courseId: z.string().uuid().optional(),
        classId: z.string().uuid().optional(),
        limit: z.coerce.number().int().positive().max(100).optional(),
        offset: z.coerce.number().int().min(0).optional()
    });

    router.get('/', ...protectedMiddleware, asyncHandler(async (req, res) => {
        const schoolId = (req as SchoolContextRequest).schoolId as string;

        const query = querySchema.parse({
            name: typeof req.query.name === 'string' ? req.query.name : undefined,
            courseId: typeof req.query.courseId === 'string' ? req.query.courseId : undefined,
            classId: typeof req.query.classId === 'string' ? req.query.classId : undefined,
            limit: req.query.limit,
            offset: req.query.offset
        });

        const result = await deps.listSchoolStudents.exec({
            schoolId,
            name: query.name,
            courseId: query.courseId,
            classId: query.classId,
            limit: query.limit,
            offset: query.offset
        });

        res.json({
            students: result.students,
            pagination: {
                total: result.total,
                limit: result.limit,
                offset: result.offset,
                totalPage: Math.ceil(result.total / result.limit),
                currentPage: Math.floor(result.offset / result.limit) + 1,
                hasMore: result.offset + result.limit < result.total
            }
        });
    }));

    if (deps.consolidateSchoolStudentFinancial) {
        router.get(
            '/:studentId/financial-summary',
            ...protectedMiddleware,
            asyncHandler(async (req, res) => {
                const paramsSchema = z.object({ studentId: z.string().uuid() });
                const { studentId } = paramsSchema.parse(req.params);
                const schoolId = (req as SchoolContextRequest).schoolId as string;

                const summary = await deps.consolidateSchoolStudentFinancial!.exec({
                    schoolId,
                    studentId
                });

                if (!summary) {
                    return res.status(404).json({
                        error: 'Aluno não encontrado ou não está vinculado a esta escola',
                        code: 'STUDENT_NOT_FOUND'
                    });
                }

                res.json(summary);
            })
        );
    }

    // Rota de detalhes do aluno por ID
    if (deps.getSchoolStudentDetails) {
        router.get('/:studentId', ...protectedMiddleware, asyncHandler(async (req, res) => {
            const paramsSchema = z.object({ studentId: z.string().uuid() });
            const { studentId } = paramsSchema.parse(req.params);
            const schoolId = (req as SchoolContextRequest).schoolId as string;
            const querySchema = z.object({
                dependentId: z.string().uuid().optional()
            });
            const query = querySchema.parse({
                dependentId: typeof req.query.dependentId === 'string' ? req.query.dependentId : undefined
            });

            const details = await deps.getSchoolStudentDetails!.exec({
                schoolId,
                studentId,
                dependentId: query.dependentId
            });

            if (!details) {
                return res.status(404).json({
                    error: 'Aluno não encontrado ou não está vinculado a esta escola',
                    code: 'STUDENT_NOT_FOUND'
                });
            }

            res.json(details);
        }));
    }

    return router;
}
