export type PaymentAuthorized = { type: 'PaymentAuthorized'; paymentId: string; providerRef: string };
export type PaymentCaptured = { type: 'PaymentCaptured'; paymentId: string; amount: number };
export type DomainEvent = PaymentAuthorized | PaymentCaptured;
