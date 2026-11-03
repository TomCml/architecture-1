export type EventStatus = 'OPEN' | 'CANCELLED';
export type ReservationStatus = 'PENDING' | 'CONFIRMED' | 'FAILED' | 'EXPIRED';
export type PaymentStatus = 'PENDING' | 'SUCCEEDED' | 'FAILED';
export type PaymentScenario = 'success' | 'failure' | 'slow';

export const PAYMENT_SCENARIOS: readonly PaymentScenario[] = ['success', 'failure', 'slow'];
