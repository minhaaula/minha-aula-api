import 'dotenv/config';
import path from 'path';
import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { PaymentOrm } from './entities/payment.orm';
import { OutboxOrm } from './entities/outbox.orm';
import { IdempotencyOrm } from './entities/idempotency.orm';
import { UserOrm } from './entities/user.orm';
import { SchoolOrm } from './entities/school.orm';
import { CourseOrm } from './entities/course.orm';
import { CourseClassOrm } from './entities/course-class.orm';
import { DependentOrm } from './entities/dependent.orm';
import { EnrollmentOrm } from './entities/enrollment.orm';
import { NotificationOrm } from './entities/notification.orm';
import { EnrollmentRequestOrm } from './entities/enrollment-request.orm';
import { SchoolAddressOrm } from './entities/school-address.orm';
import { ClassSessionOrm } from './entities/class-session.orm';
import { CategoryOrm } from './entities/category.orm';
import { SubcategoryOrm } from './entities/subcategory.orm';
import { CourseCategoryOrm } from './entities/course-category.orm';
import { CourseCategorySubcategoryOrm } from './entities/course-category-subcategory.orm';
import { SubscriptionPlanOrm } from './entities/subscription-plan.orm';
import { SchoolPlanFinanceOrm } from './entities/school-plan-finance.orm';
import { SchoolPlanInvoiceOrm } from './entities/school-plan-invoice.orm';
import { SchoolFinancialChargeOrm } from './entities/school-financial-charge.orm';
import { SchoolBankAccountOrm } from './entities/school-bank-account.orm';
import { SchoolWithdrawalOrm } from './entities/school-withdrawal.orm';
import { PasswordResetTokenOrm } from './entities/password-reset-token.orm';
import { SchoolReviewOrm } from './entities/school-review.orm';
import { SchoolImageOrm } from './entities/school-image.orm';
import { DiscountCouponOrm } from './entities/discount-coupon.orm';
import { UserPushTokenOrm } from './entities/user-push-token.orm';
import { ChargeDueReminderOrm } from './entities/charge-due-reminder.orm';

export const AppDataSource = new DataSource({
    type: 'mysql',
    host: process.env.DB_HOST,
    port: +(process.env.DB_PORT ?? 3306),
    username: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
    entities: [
        PaymentOrm,
        OutboxOrm,
        IdempotencyOrm,
        UserOrm,
        SchoolOrm,
        SchoolAddressOrm,
        ClassSessionOrm,
        CategoryOrm,
        SubcategoryOrm,
        CourseCategoryOrm,
        CourseCategorySubcategoryOrm,
        CourseOrm,
        CourseClassOrm,
        DependentOrm,
        EnrollmentOrm,
        NotificationOrm,
        EnrollmentRequestOrm,
        SubscriptionPlanOrm,
        SchoolPlanFinanceOrm,
        SchoolPlanInvoiceOrm,
        SchoolFinancialChargeOrm,
        SchoolBankAccountOrm,
        SchoolWithdrawalOrm,
        PasswordResetTokenOrm,
        SchoolReviewOrm,
        SchoolImageOrm,
        DiscountCouponOrm,
        UserPushTokenOrm,
        ChargeDueReminderOrm
    ],
    synchronize: false,
    // Em dev (`ts-node` em `src/...`) usa `*.ts`; após build (`node` em `dist/...`) usa `*.js`.
    migrations: [
        path.join(__dirname, 'migrations', __filename.endsWith('.ts') ? '*.ts' : '*.js')
    ],
    extra: { decimalNumbers: true }
});
