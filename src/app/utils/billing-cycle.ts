export function calculateNextBillingDate(
    billingCycle: 'MONTHLY' | 'ANNUAL',
    fromDate: Date = new Date()
): Date {
    const base = new Date(fromDate);
    const due = new Date(base.getTime());
    if (billingCycle === 'ANNUAL') {
        due.setFullYear(due.getFullYear() + 1);
    } else {
        due.setMonth(due.getMonth() + 1);
    }
    return due;
}
