import { Router } from 'express';
import { asyncHandler } from '../../utils/async-handler';
import { SchoolContextRequest } from '../../middlewares/resolve-school-context';
import { SchoolRouteGuards } from './guards';
import { GetSchoolDashboard } from '../../../../app/use-cases/get-school-dashboard';

export interface DashboardRoutesDeps {
    getSchoolDashboard: GetSchoolDashboard;
}

export function buildDashboardRoutes(deps: DashboardRoutesDeps, guards: SchoolRouteGuards) {
    const router = Router();

    const protectedMiddleware = [
        guards.requireAuth,
        guards.requireSchoolPersona,
        guards.resolveSchoolContext
    ] as const;

    router.get('/', ...protectedMiddleware, asyncHandler(async (req, res) => {
        const schoolId = (req as SchoolContextRequest).schoolId as string;

        const result = await deps.getSchoolDashboard.exec({ schoolId });

        res.json({
            summary: {
                totalStudents: result.totalStudents,
                totalClasses: result.totalClasses,
                totalCourses: result.totalCourses,
                currentMonthRevenue: result.currentMonthRevenueCents / 100,
                currentMonthRevenueCents: result.currentMonthRevenueCents,
                revenueForecast: result.revenueForecastCents / 100,
                revenueForecastCents: result.revenueForecastCents,
                revenueChangePercentage: result.revenueChangePercentage,
                pendingEnrollmentRequests: result.pendingEnrollmentRequestsCount
            },
            overduePayments: {
                totalAmount: result.overduePayments.totalAmountCents / 100,
                totalAmountCents: result.overduePayments.totalAmountCents,
                count: result.overduePayments.count
            },
            recentEnrollments: result.recentEnrollments.map(e => ({
                studentId: e.studentId,
                studentName: e.studentName,
                courseName: e.courseName,
                className: e.className,
                enrolledAt: e.createdAt
            })),
            revenueHistory: result.monthlyRevenueHistory.map(h => ({
                month: h.month,
                value: h.valueCents / 100,
                valueCents: h.valueCents
            }))
        });
    }));

    return router;
}

