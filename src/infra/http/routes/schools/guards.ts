import type { RequestHandler } from 'express';

export type SchoolRouteGuards = {
    requireAuth: RequestHandler;
    requireSchoolPersona: RequestHandler;
    resolveSchoolContext: RequestHandler;
};
